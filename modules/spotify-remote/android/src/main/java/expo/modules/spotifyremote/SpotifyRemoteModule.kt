package expo.modules.spotifyremote

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.core.os.bundleOf
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import com.spotify.android.appremote.api.error.AuthenticationFailedException
import com.spotify.android.appremote.api.error.CouldNotFindSpotifyApp
import com.spotify.android.appremote.api.error.NotLoggedInException
import com.spotify.android.appremote.api.error.OfflineModeException
import com.spotify.android.appremote.api.error.SpotifyConnectionTerminatedException
import com.spotify.android.appremote.api.error.SpotifyDisconnectedException
import com.spotify.android.appremote.api.error.UnsupportedFeatureVersionException
import com.spotify.android.appremote.api.error.UserNotAuthorizedException
import com.spotify.protocol.client.Subscription
import com.spotify.protocol.types.PlayerState
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val SPOTIFY_PACKAGE = "com.spotify.music"
private const val SEEK_FALLBACK_DELAY_MS = 1200L

class SpotifyRemoteModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val mainHandler = Handler(Looper.getMainLooper())
  private var appRemote: SpotifyAppRemote? = null
  private var stateSubscription: Subscription<PlayerState>? = null

  // Seek koji čeka da Spotify zaista krene sa novom pesmom (play pa seek).
  private var pendingSeekUri: String? = null
  private var pendingSeekMs: Long = 0

  override fun definition() = ModuleDefinition {
    Name("SpotifyRemote")

    Events("onPlayerState", "onDisconnected")

    Function("isSpotifyInstalled") {
      isInstalled(context)
    }

    Function("isConnected") {
      appRemote?.isConnected == true
    }

    Function("openSpotify") {
      val intent = context.packageManager.getLaunchIntentForPackage(SPOTIFY_PACKAGE)
        ?: return@Function false
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }

    AsyncFunction("connect") { clientId: String, redirectUri: String, promise: Promise ->
      val existing = appRemote
      if (existing != null && existing.isConnected) {
        promise.resolve(true)
        return@AsyncFunction
      }
      if (!isInstalled(context)) {
        promise.reject("NOT_INSTALLED", "Spotify aplikacija nije instalirana", null)
        return@AsyncFunction
      }
      val params = ConnectionParams.Builder(clientId)
        .setRedirectUri(redirectUri)
        .showAuthView(true)
        .build()
      val connectContext: Context = appContext.currentActivity ?: context
      var settled = false
      SpotifyAppRemote.connect(connectContext, params, object : Connector.ConnectionListener {
        override fun onConnected(remote: SpotifyAppRemote) {
          appRemote = remote
          subscribeToPlayerState(remote)
          if (!settled) {
            settled = true
            promise.resolve(true)
          }
        }

        override fun onFailure(error: Throwable) {
          // onFailure se zove i kasnije, kad se već uspostavljena veza prekine.
          stateSubscription = null
          appRemote = null
          if (!settled) {
            settled = true
            promise.reject(codeFor(error), error.message ?: "Povezivanje sa Spotify-jem nije uspelo", error)
          } else {
            sendEvent("onDisconnected", bundleOf("code" to codeFor(error), "message" to (error.message ?: "")))
          }
        }
      })
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("disconnect") {
      disconnectRemote()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") { uri: String, positionMs: Double, promise: Promise ->
      val remote = connectedRemote(promise) ?: return@AsyncFunction
      if (positionMs > 0) {
        pendingSeekUri = uri
        pendingSeekMs = positionMs.toLong()
      } else {
        pendingSeekUri = null
      }
      remote.playerApi.play(uri)
        .setResultCallback {
          if (pendingSeekUri == uri) {
            // Rezerva ako player state ne stigne na vreme.
            mainHandler.postDelayed({ applyPendingSeek(uri) }, SEEK_FALLBACK_DELAY_MS)
          }
          promise.resolve()
        }
        .setErrorCallback { error ->
          pendingSeekUri = null
          promise.reject(codeFor(error), error.message ?: "Puštanje nije uspelo", error)
        }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") { promise: Promise ->
      val remote = connectedRemote(promise) ?: return@AsyncFunction
      remote.playerApi.pause()
        .setResultCallback { promise.resolve() }
        .setErrorCallback { error -> promise.reject(codeFor(error), error.message, error) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("resume") { promise: Promise ->
      val remote = connectedRemote(promise) ?: return@AsyncFunction
      remote.playerApi.resume()
        .setResultCallback { promise.resolve() }
        .setErrorCallback { error -> promise.reject(codeFor(error), error.message, error) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("seekTo") { positionMs: Double, promise: Promise ->
      val remote = connectedRemote(promise) ?: return@AsyncFunction
      remote.playerApi.seekTo(positionMs.toLong())
        .setResultCallback { promise.resolve() }
        .setErrorCallback { error -> promise.reject(codeFor(error), error.message, error) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setShuffle") { enabled: Boolean, promise: Promise ->
      val remote = connectedRemote(promise) ?: return@AsyncFunction
      remote.playerApi.setShuffle(enabled)
        .setResultCallback { promise.resolve() }
        .setErrorCallback { error -> promise.reject(codeFor(error), error.message, error) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("queue") { uri: String, promise: Promise ->
      val remote = connectedRemote(promise) ?: return@AsyncFunction
      remote.playerApi.queue(uri)
        .setResultCallback { promise.resolve() }
        .setErrorCallback { error -> promise.reject(codeFor(error), error.message, error) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getPlayerState") { promise: Promise ->
      val remote = connectedRemote(promise) ?: return@AsyncFunction
      remote.playerApi.playerState
        .setResultCallback { state -> promise.resolve(stateToMap(state)) }
        .setErrorCallback { error -> promise.reject(codeFor(error), error.message, error) }
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      mainHandler.post { disconnectRemote() }
    }
  }

  private fun isInstalled(ctx: Context): Boolean =
    try {
      ctx.packageManager.getPackageInfo(SPOTIFY_PACKAGE, 0)
      true
    } catch (e: Exception) {
      SpotifyAppRemote.isSpotifyInstalled(ctx)
    }

  private fun connectedRemote(promise: Promise): SpotifyAppRemote? {
    val remote = appRemote
    if (remote == null || !remote.isConnected) {
      promise.reject("NOT_CONNECTED", "Spotify App Remote nije povezan", null)
      return null
    }
    return remote
  }

  private fun subscribeToPlayerState(remote: SpotifyAppRemote) {
    stateSubscription?.cancel()
    val subscription = remote.playerApi.subscribeToPlayerState()
    subscription.setEventCallback { state ->
      val uri = state.track?.uri
      if (uri != null && uri == pendingSeekUri) {
        applyPendingSeek(uri)
      }
      sendEvent("onPlayerState", stateToMap(state))
    }
    stateSubscription = subscription
  }

  private fun applyPendingSeek(uri: String) {
    if (pendingSeekUri != uri) return
    val remote = appRemote ?: return
    val position = pendingSeekMs
    pendingSeekUri = null
    remote.playerApi.seekTo(position)
  }

  private fun disconnectRemote() {
    stateSubscription?.cancel()
    stateSubscription = null
    appRemote?.let { SpotifyAppRemote.disconnect(it) }
    appRemote = null
  }

  private fun stateToMap(state: PlayerState): Map<String, Any?> {
    val track = state.track
    return mapOf(
      "trackUri" to track?.uri,
      "trackName" to track?.name,
      "artistName" to track?.artist?.name,
      "albumName" to track?.album?.name,
      "durationMs" to (track?.duration ?: 0L).toDouble(),
      "positionMs" to state.playbackPosition.toDouble(),
      "isPaused" to state.isPaused
    )
  }

  private fun codeFor(error: Throwable): String = when (error) {
    is CouldNotFindSpotifyApp -> "NOT_INSTALLED"
    is NotLoggedInException -> "NOT_LOGGED_IN"
    is UserNotAuthorizedException -> "NOT_AUTHORIZED"
    is AuthenticationFailedException -> "AUTH_FAILED"
    is OfflineModeException -> "OFFLINE"
    is UnsupportedFeatureVersionException -> "UNSUPPORTED_VERSION"
    is SpotifyDisconnectedException, is SpotifyConnectionTerminatedException -> "DISCONNECTED"
    else -> "UNKNOWN"
  }
}
