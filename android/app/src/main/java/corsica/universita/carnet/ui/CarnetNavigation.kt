package corsica.universita.carnet.ui

import androidx.compose.runtime.Composable
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import corsica.universita.carnet.ui.notes.NotesListScreen
import kotlinx.serialization.Serializable

/** Clé de l'écran « liste des notes » : une entrée typée du backstack (Navigation 3). */
@Serializable
data object NotesList : NavKey

/**
 * Navigation 3 : le backstack est un état (`rememberNavBackStack`), sauvegardé à la rotation.
 * Un seul écran pour l'instant ; le détail d'une note (NoteDetail) arrive au TD A7.
 */
@Composable
fun CarnetNavigation() {
    val backStack = rememberNavBackStack(NotesList)
    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        entryProvider = entryProvider {
            entry<NotesList> { NotesListScreen() }
        },
    )
}
