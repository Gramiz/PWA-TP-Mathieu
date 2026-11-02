package corsica.universita.carnet

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import corsica.universita.carnet.ui.CarnetNavigation
import corsica.universita.carnet.ui.theme.CarnetTheme

/** L'unique Activity de Carnet : un écran, lancé par l'OS sur l'intent MAIN / LAUNCHER. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen() // avant super.onCreate : l'écran de démarrage, puis Theme.Carnet.Main
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CarnetTheme {
                CarnetNavigation()
            }
        }
    }
}
