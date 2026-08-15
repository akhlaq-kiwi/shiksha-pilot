package com.shikshapilot.nativeapp.features.studentparent.screens

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.DeviceRegisterRequestDto
import com.shikshapilot.nativeapp.data.remote.NotificationEventDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Notification preferences — GET /api/notifications/catalog (NotificationCatalog::EVENTS map) +
 * POST /api/notifications/device (DeviceTokenService::register).
 *
 * IMPORTANT — this does NOT deliver real push notifications. There is no Firebase/FCM
 * integration anywhere in native-app (no google-services.json, no `com.google.gms.google-services`
 * Gradle plugin, no FirebaseMessagingService subclass) — confirmed by searching the whole
 * native-app/ tree. The backend's push pipeline (PushDispatcher, DeviceTokenController,
 * NotificationCatalog) is ready to receive a real FCM device token, but this screen can only
 * register a placeholder locally-generated token string (persisted in this composable's session)
 * so the preferences/catalog UI can be exercised against the real API. See
 * native-app/PARITY_GAPS.md for what's required to complete real push delivery.
 */
@Composable
fun NotificationPreferencesScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var events by remember { mutableStateOf<Map<String, NotificationEventDto>>(emptyMap()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var enabledCategories by remember { mutableStateOf<Set<String>>(emptySet()) }
    var registered by remember { mutableStateOf(false) }
    var registerMessage by remember { mutableStateOf<String?>(null) }
    var testPushMessage by remember { mutableStateOf<String?>(null) }

    // Placeholder token — NOT a real FCM registration token, since Firebase isn't wired up yet.
    val placeholderToken = remember { "local-placeholder-${Build.MODEL}-${UUID.randomUUID()}" }

    LaunchedEffect(Unit) {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getNotificationCatalog()
                if (response.isSuccessful && response.body() != null) {
                    events = response.body()!!.data?.events ?: emptyMap()
                    enabledCategories = events.values.mapNotNull { it.category }.toSet()
                } else {
                    errorMessage = "Unable to load notification catalog (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading notification catalog"
            } finally {
                isLoading = false
            }
        }
    }

    fun register() {
        scope.launch {
            try {
                val response = RetrofitClient.apiService.registerDevice(
                    DeviceRegisterRequestDto(token = placeholderToken, platform = "android")
                )
                if (response.isSuccessful) {
                    registered = true
                    registerMessage = "Device registered (placeholder token — see note below)."
                } else {
                    registerMessage = "Registration failed (code ${response.code()})"
                }
            } catch (e: Exception) {
                registerMessage = e.message ?: "Network error while registering device"
            }
        }
    }

    fun sendTestPush() {
        scope.launch {
            try {
                val response = RetrofitClient.apiService.testPush()
                testPushMessage = if (response.isSuccessful) {
                    "Test push queued server-side at ${response.body()?.data?.timestamp ?: "-"}. It will NOT arrive on this device (no FCM wiring)."
                } else {
                    "Test push failed (code ${response.code()})"
                }
            } catch (e: Exception) {
                testPushMessage = e.message ?: "Network error while sending test push"
            }
        }
    }

    val categories = events.values.mapNotNull { it.category }.distinct().sorted()

    Scaffold(containerColor = DarkCanvas) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(
                    schoolName = schoolName,
                    unreadNotificationCount = 0,
                    onNotificationClick = onNotificationClick,
                    onAvatarClick = onAvatarClick
                )

                Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = CircleShape)
                                .clickable { onBack() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(imageVector = Icons.Default.ArrowBackIos, contentDescription = "Back", tint = TextPrimary, modifier = Modifier.size(16.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(text = "Notifications", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(text = "QA Server: GET /api/notifications/catalog", fontSize = 10.5.sp, color = SunsetOrange)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(WarningYellow.copy(alpha = 0.12f))
                            .border(1.dp, WarningYellow, RoundedCornerShape(14.dp))
                            .padding(12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.Top) {
                            Icon(imageVector = Icons.Default.WarningAmber, contentDescription = "Warning", tint = WarningYellow, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Real push delivery is NOT implemented yet — no Firebase/FCM project is configured in this app. " +
                                    "You can still view categories and register a placeholder device token against the live backend.",
                                fontSize = 11.5.sp,
                                color = TextPrimary
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Button(
                            onClick = { register() },
                            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange),
                            enabled = !registered
                        ) {
                            Text(text = if (registered) "Registered" else "Register This Device", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        OutlinedButton(onClick = { sendTestPush() }) {
                            Text(text = "Send Test Push", fontSize = 12.sp, color = TextPrimary)
                        }
                    }

                    registerMessage?.let {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(text = it, fontSize = 11.5.sp, color = OnlineGreen)
                    }
                    testPushMessage?.let {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(text = it, fontSize = 11.5.sp, color = InfoBlue)
                    }

                    Spacer(modifier = Modifier.height(14.dp))
                    Text(text = "NOTIFICATION CATEGORIES", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = TextSecondary)
                    Spacer(modifier = Modifier.height(8.dp))

                    when {
                        isLoading -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                            }
                        }
                        errorMessage != null -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        categories.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No notification categories found.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxSize()) {
                                items(categories) { category ->
                                    val eventsInCategory = events.filterValues { it.category == category }
                                    val enabled = enabledCategories.contains(category)
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(FrostedCard)
                                            .border(1.dp, CardBorder, RoundedCornerShape(14.dp))
                                            .padding(12.dp)
                                    ) {
                                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(text = category, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                Text(
                                                    text = "${eventsInCategory.size} event type(s) • e.g. ${eventsInCategory.values.firstOrNull()?.label ?: eventsInCategory.keys.firstOrNull() ?: "-"}",
                                                    fontSize = 11.5.sp,
                                                    color = TextSecondary
                                                )
                                            }
                                            Switch(
                                                checked = enabled,
                                                onCheckedChange = { checked ->
                                                    enabledCategories = if (checked) enabledCategories + category else enabledCategories - category
                                                },
                                                colors = SwitchDefaults.colors(checkedTrackColor = SunsetOrange)
                                            )
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
}
