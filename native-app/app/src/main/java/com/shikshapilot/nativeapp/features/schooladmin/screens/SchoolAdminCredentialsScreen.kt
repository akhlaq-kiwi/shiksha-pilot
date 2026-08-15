package com.shikshapilot.nativeapp.features.schooladmin.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.CredentialsDto
import com.shikshapilot.nativeapp.data.remote.GenerateCredentialsRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.StaffItemDto
import com.shikshapilot.nativeapp.data.remote.StudentItemDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch

/**
 * Backend: GET api/school/credentials/{role}/{id} (SchoolAdminService::getCredentials — looks up
 * the phone number for a TEACHER (staff.phone) or PARENT/STUDENT (students.parent_phone ||
 * father_phone || guardian_phone || student_mobile), then returns the `users` row's plain_password
 * if a login already exists for that phone), POST api/school/credentials/generate (same phone
 * resolution, then generates or accepts a manual >=6 char password, hashes it, and
 * upserts/activates the `users` row). Reuses existing GET api/school/students and
 * api/school/staff lists (already in ApiService) to let the admin pick a person rather than
 * building a separate directory — there is no dedicated "credentials list" endpoint, generation is
 * inherently per-student/per-staff triggered from this picker.
 */
@Composable
fun SchoolAdminCredentialsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var activeTab by remember { mutableStateOf(0) } // 0 = Students (Parent login), 1 = Staff
    var students by remember { mutableStateOf<List<StudentItemDto>>(emptyList()) }
    var staff by remember { mutableStateOf<List<StaffItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    var selectedRole by remember { mutableStateOf<String?>(null) }
    var selectedId by remember { mutableStateOf<Int?>(null) }
    var selectedName by remember { mutableStateOf<String?>(null) }
    var dialogLoading by remember { mutableStateOf(false) }
    var dialogCredentials by remember { mutableStateOf<CredentialsDto?>(null) }
    var dialogError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(activeTab, refreshKey) {
        isLoading = true
        errorMessage = null
        try {
            if (activeTab == 0) {
                val r = RetrofitClient.apiService.getStudents()
                if (r.isSuccessful) students = r.body()?.data ?: emptyList()
                else errorMessage = "Unable to load students (code ${r.code()})"
            } else {
                val r = RetrofitClient.apiService.getStaff()
                if (r.isSuccessful) staff = r.body()?.data ?: emptyList()
                else errorMessage = "Unable to load staff (code ${r.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error"
        } finally {
            isLoading = false
        }
    }

    fun openCredentials(role: String, id: Int, name: String) {
        selectedRole = role
        selectedId = id
        selectedName = name
        dialogCredentials = null
        dialogError = null
        dialogLoading = true
        scope.launch {
            try {
                val r = RetrofitClient.apiService.getCredentials(role, id)
                if (r.isSuccessful) {
                    dialogCredentials = r.body()?.data
                } else {
                    dialogError = "Unable to load credentials (code ${r.code()})"
                }
            } catch (e: Exception) {
                dialogError = e.message ?: "Network error"
            } finally {
                dialogLoading = false
            }
        }
    }

    fun generate() {
        val role = selectedRole ?: return
        val id = selectedId ?: return
        dialogLoading = true
        scope.launch {
            try {
                val r = RetrofitClient.apiService.generateCredentials(GenerateCredentialsRequestDto(role = role, id = id))
                if (r.isSuccessful && r.body()?.data != null) {
                    dialogCredentials = r.body()!!.data
                    Toast.makeText(context, "Credentials generated", Toast.LENGTH_SHORT).show()
                } else {
                    dialogError = "Failed to generate (code ${r.code()})"
                }
            } catch (e: Exception) {
                dialogError = e.message ?: "Network error"
            } finally {
                dialogLoading = false
            }
        }
    }

    Scaffold(containerColor = DarkCanvas) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { refreshKey++ }) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(schoolName = schoolName, unreadNotificationCount = 2, onNotificationClick = {}, onAvatarClick = {})

                Column(modifier = Modifier.fillMaxSize().padding(horizontal = 13.dp, vertical = 10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = CircleShape)
                                .clickable { onBack() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(imageVector = Icons.Default.ArrowBackIos, contentDescription = "Back", tint = TextPrimary, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = "Login Credentials", fontSize = 15.5.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(text = "Generate & view student/staff credentials", fontSize = 10.sp, color = SunsetOrange)
                        }
                    }

                    Spacer(modifier = Modifier.height(11.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(FrostedCard)
                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                            .padding(4.dp)
                    ) {
                        listOf("Students (Parent)" to 0, "Staff" to 1).forEach { (label, idx) ->
                            val selected = activeTab == idx
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (selected) SunsetOrange else Color.Transparent)
                                    .clickable { activeTab = idx }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = label, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = if (selected) Color.White else TextSecondary)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(11.dp))

                    when {
                        isLoading -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                            }
                        }
                        errorMessage != null -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 11.sp)
                            }
                        }
                        activeTab == 0 -> {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                                items(students) { s ->
                                    PersonRow(name = s.name, subtitle = "${s.class_name ?: ""} ${s.section ?: ""}".trim()) {
                                        openCredentials("PARENT", s.id, s.name)
                                    }
                                }
                            }
                        }
                        else -> {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                                items(staff) { s ->
                                    PersonRow(name = s.name, subtitle = s.role ?: "") {
                                        openCredentials("TEACHER", s.id, s.name)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            }
        }
    }

    if (selectedRole != null && selectedId != null) {
        AlertDialog(
            onDismissRequest = { selectedRole = null; selectedId = null },
            title = { Text(selectedName ?: "Credentials") },
            text = {
                Column {
                    when {
                        dialogLoading -> Text("Loading...", color = TextSecondary)
                        dialogError != null -> Text(dialogError ?: "", color = Color(0xFFEF4444))
                        dialogCredentials?.phone != null -> {
                            Text("Phone: ${dialogCredentials?.phone}", color = TextPrimary)
                            Spacer(modifier = Modifier.height(3.dp))
                            Text("Password: ${dialogCredentials?.plain_password ?: "(hidden)"}", color = OnlineGreen, fontWeight = FontWeight.Bold)
                        }
                        else -> Text("No login credentials found for this profile yet. Tap Generate to create one.", color = TextSecondary)
                    }
                }
            },
            confirmButton = {
                Text(
                    text = if (dialogLoading) "..." else "Generate",
                    color = SunsetOrange,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(12.dp).clickable(enabled = !dialogLoading) { generate() }
                )
            },
            dismissButton = {
                Text(text = "Close", color = TextSecondary, modifier = Modifier.padding(12.dp).clickable { selectedRole = null; selectedId = null })
            }
        )
    }
}

@Composable
private fun PersonRow(name: String, subtitle: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .padding(14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(32.dp).clip(CircleShape).background(SunsetOrange.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = Icons.Default.Person, contentDescription = "Person", tint = SunsetOrange, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = name, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                if (subtitle.isNotBlank()) {
                    Text(text = subtitle, fontSize = 10.sp, color = TextSecondary)
                }
            }
            Icon(imageVector = Icons.Default.Key, contentDescription = "Credentials", tint = TextSecondary, modifier = Modifier.size(20.dp))
        }
    }
}
