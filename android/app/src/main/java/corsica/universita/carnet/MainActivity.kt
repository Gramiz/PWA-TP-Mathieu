package corsica.universita.carnet

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.LifecycleEventObserver
import corsica.universita.carnet.data.Note
import corsica.universita.carnet.ui.CarnetNavigation
import corsica.universita.carnet.ui.notes.NotesViewModel
import corsica.universita.carnet.ui.theme.CarnetTheme

/** L'unique Activity de Carnet : un écran, lancé par l'OS sur l'intent MAIN / LAUNCHER. */
class MainActivity : ComponentActivity() {
    private val notesViewModel: NotesViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen() // avant super.onCreate : l'écran de démarrage, puis Theme.Carnet.Main
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        lifecycle.addObserver(LifecycleEventObserver { _, event ->
            Log.d("Carnet", "Activity ${event.name} — instance ${System.identityHashCode(this)}")
        })
        if (savedInstanceState == null) handleIntent(intent)
        setContent {
            CarnetTheme {
                CarnetNavigation(notesViewModel, ::shareNote, ::openPwa)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        when (intent.action) {
            Intent.ACTION_SEND -> if (intent.type == "text/plain") {
                intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.let {
                    notesViewModel.receiveSharedText(it.toString())
                    Log.d("Carnet", "ACTION_SEND reçu")
                }
            }
            Intent.ACTION_VIEW -> intent.data?.let { uri ->
                if (uri.scheme == "https" && uri.host == BuildConfig.PWA_HOST) {
                    notesViewModel.receiveSharedText(uri.toString())
                    Log.d("Carnet", "ACTION_VIEW reçu (App Link)")
                }
            }
        }
    }

    private fun shareNote(note: Note) {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, note.text)
        }
        startActivity(Intent.createChooser(send, getString(R.string.share_chooser_title)))
    }

    private fun openPwa() {
        // Le sélecteur cible un navigateur pour éviter de revenir dans Carnet via l’App Link.
        val browser = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_BROWSER).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("https://${BuildConfig.PWA_HOST}/")
        }
        try {
            startActivity(browser)
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.browser_unavailable, Toast.LENGTH_LONG).show()
        }
    }
}
