package corsica.universita.carnet.ui.notes

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import corsica.universita.carnet.data.Note
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class NotesViewModel(private val savedState: SavedStateHandle) : ViewModel() {
    private val _notes = MutableStateFlow<List<Note>>(emptyList())
    val notes: StateFlow<List<Note>> = _notes.asStateFlow()
    val draft: StateFlow<String> = savedState.getStateFlow("draft", "")
    private var nextId = 0L

    init {
        Log.d("Carnet", "NotesViewModel créé — instance ${System.identityHashCode(this)}")
    }

    fun onDraftChange(text: String) {
        savedState["draft"] = text
    }

    fun addNote() {
        val text = draft.value.trim()
        if (text.isEmpty()) return
        val note = Note(++nextId, text, System.currentTimeMillis())
        _notes.update { listOf(note) + it }
        savedState["draft"] = ""
    }

    fun deleteNote(id: Long) {
        _notes.update { notes -> notes.filterNot { it.id == id } }
    }
}
