package corsica.universita.carnet.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = Sage,
    onPrimary = Paper,
    primaryContainer = SageLight,
    onPrimaryContainer = Ink,
    secondary = Ochre,
    onSecondary = Paper,
    secondaryContainer = OchreLight,
    onSecondaryContainer = Ink,
    background = Paper,
    onBackground = Ink,
    surface = Paper,
    onSurface = Ink,
)

private val DarkColors = darkColorScheme(
    primary = SageLight,
    onPrimary = Ink,
    primaryContainer = SageDark,
    onPrimaryContainer = Paper,
    secondary = OchreLight,
    onSecondary = Ink,
    secondaryContainer = Ochre,
    onSecondaryContainer = Paper,
    background = Ink,
    onBackground = Paper,
    surface = Ink,
    onSurface = Paper,
)

/** Thème Material 3 de Carnet : mode sombre suivi automatiquement. */
@Composable
fun CarnetTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, typography = CarnetTypography, content = content)
}
