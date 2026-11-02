package corsica.universita.carnet.ui.notes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import corsica.universita.carnet.R
import corsica.universita.carnet.data.Note
import corsica.universita.carnet.ui.theme.CarnetTheme
import java.text.DateFormat
import java.util.Date

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotesListScreen() {
    val notes = remember { mutableStateListOf<Note>() }
    var draft by rememberSaveable { mutableStateOf("") }

    Scaffold(
        topBar = { TopAppBar(title = { Text(stringResource(R.string.app_name)) }) },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).imePadding().padding(16.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    label = { Text(stringResource(R.string.draft_hint)) },
                    modifier = Modifier.weight(1f),
                )
                Button(
                    enabled = draft.isNotBlank(),
                    onClick = {
                        notes.add(0, Note(draft.trim(), System.currentTimeMillis()))
                        draft = ""
                    },
                ) { Text(stringResource(R.string.add)) }
            }
            Text(
                text = pluralStringResource(R.plurals.notes_count, notes.size, notes.size),
                modifier = Modifier.padding(vertical = 12.dp),
                style = MaterialTheme.typography.bodyMedium,
            )
            LazyColumn(modifier = Modifier.weight(1f)) {
                items(notes) { note ->
                    ListItem(
                        headlineContent = { Text(note.text) },
                        supportingContent = { Text(note.createdAt.toDateTime()) },
                        trailingContent = {
                            IconButton(onClick = { notes.remove(note) }) {
                                Icon(
                                    imageVector = Icons.Default.Delete,
                                    contentDescription = stringResource(R.string.delete_note, note.text),
                                )
                            }
                        },
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

private fun Long.toDateTime(): String = DateFormat.getDateTimeInstance(
    DateFormat.SHORT,
    DateFormat.SHORT,
).format(Date(this))

@Preview(showBackground = true)
@Composable
private fun NotesListScreenPreview() {
    CarnetTheme { NotesListScreen() }
}
