package com.shikshapilot.nativeapp.ui.screens

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.ChangePasswordRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.repository.UserRepository
import com.shikshapilot.nativeapp.ui.components.FlashMessage
import com.shikshapilot.nativeapp.ui.components.FlashMessageType
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.components.TopFlashBanner
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onLogoutClick: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val userProfile by UserRepository.currentUser.collectAsState()
    val coroutineScope = rememberCoroutineScope()

    var isProfileLoading by remember { mutableStateOf(true) }
    var flashMessage by remember { mutableStateOf<FlashMessage?>(null) }

    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var isCurrentVisible by remember { mutableStateOf(false) }
    var isNewVisible by remember { mutableStateOf(false) }
    var isChangingPassword by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        isProfileLoading = true
        UserRepository.refreshProfileFromApi()
        isProfileLoading = false
    }

    val submitPasswordChange = {
        when {
            newPassword.trim().isEmpty() -> {
                flashMessage = FlashMessage("New password is required", FlashMessageType.ERROR)
            }
            newPassword.trim().length < 6 -> {
                flashMessage = FlashMessage("New password must be at least 6 characters", FlashMessageType.ERROR)
            }
            newPassword.trim() != confirmPassword.trim() -> {
                flashMessage = FlashMessage("New password and confirm password do not match", FlashMessageType.ERROR)
            }
            currentPassword.trim().isEmpty() -> {
                flashMessage = FlashMessage("Current password is required", FlashMessageType.ERROR)
            }
            else -> {
                isChangingPassword = true
                flashMessage = null
                coroutineScope.launch {
                    try {
                        val response = RetrofitClient.apiService.changePassword(
                            ChangePasswordRequestDto(
                                current_password = currentPassword.trim(),
                                new_password = newPassword.trim()
                            )
                        )
                        isChangingPassword = false
                        if (response.isSuccessful) {
                            flashMessage = FlashMessage(
                                response.body()?.message ?: "Password updated successfully.",
                                FlashMessageType.SUCCESS
                            )
                            currentPassword = ""
                            newPassword = ""
                            confirmPassword = ""
                        } else {
                            flashMessage = FlashMessage(
                                response.body()?.message ?: "Unable to update password. Please check your current password.",
                                FlashMessageType.ERROR
                            )
                        }
                    } catch (e: Exception) {
                        isChangingPassword = false
                        flashMessage = FlashMessage(
                            "Unable to update password. Please check your connection and try again.",
                            FlashMessageType.ERROR
                        )
                    }
                }
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
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(
                    schoolName = schoolName,
                    unreadNotificationCount = 0,
                    onNotificationClick = onNotificationClick,
                    onAvatarClick = onAvatarClick
                )

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    // Back Header Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = CircleShape)
                                .clickable { onBack() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.ArrowBackIos,
                                contentDescription = "Back",
                                tint = TextPrimary,
                                modifier = Modifier.size(16.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Settings & Profile",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "GET /api/auth/profile",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Profile Card
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(FrostedCard)
                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(20.dp))
                            .padding(18.dp)
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(56.dp)
                                        .clip(CircleShape)
                                        .background(SunsetOrange.copy(alpha = 0.18f))
                                        .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.4f), shape = CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Person,
                                        contentDescription = "Avatar",
                                        tint = SunsetOrange,
                                        modifier = Modifier.size(28.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.width(14.dp))

                                Column {
                                    Text(
                                        text = userProfile.name,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                    Text(
                                        text = userProfile.role.replace('_', ' '),
                                        fontSize = 12.sp,
                                        color = SunsetOrange,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }

                                Spacer(modifier = Modifier.weight(1f))

                                if (isProfileLoading) {
                                    ThreeDotsLoader(
                                        dotSize = 6.dp,
                                        dotColor = SunsetOrange,
                                        spaceBetween = 5.dp,
                                        travelDistance = 5.dp
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            ProfileInfoRow(icon = Icons.Default.Phone, label = "Mobile", value = userProfile.phone)
                            Spacer(modifier = Modifier.height(10.dp))
                            ProfileInfoRow(icon = Icons.Default.Email, label = "Email", value = userProfile.email)
                            Spacer(modifier = Modifier.height(10.dp))
                            ProfileInfoRow(icon = Icons.Default.School, label = "School", value = userProfile.schoolName)
                            Spacer(modifier = Modifier.height(10.dp))
                            ProfileInfoRow(icon = Icons.Default.Badge, label = "Status", value = userProfile.status)
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    Text(
                        text = "CHANGE PASSWORD",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextSecondary,
                        letterSpacing = 1.sp
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(FrostedCard)
                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(20.dp))
                            .padding(18.dp)
                    ) {
                        Column {
                            PasswordField(
                                label = "Current Password",
                                value = currentPassword,
                                onValueChange = { currentPassword = it },
                                isVisible = isCurrentVisible,
                                onToggleVisibility = { isCurrentVisible = !isCurrentVisible }
                            )

                            Spacer(modifier = Modifier.height(14.dp))

                            PasswordField(
                                label = "New Password",
                                value = newPassword,
                                onValueChange = { newPassword = it },
                                isVisible = isNewVisible,
                                onToggleVisibility = { isNewVisible = !isNewVisible }
                            )

                            Spacer(modifier = Modifier.height(14.dp))

                            PasswordField(
                                label = "Confirm New Password",
                                value = confirmPassword,
                                onValueChange = { confirmPassword = it },
                                isVisible = isNewVisible,
                                onToggleVisibility = { isNewVisible = !isNewVisible }
                            )

                            Spacer(modifier = Modifier.height(20.dp))

                            Button(
                                onClick = { submitPasswordChange() },
                                enabled = !isChangingPassword,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                            ) {
                                if (isChangingPassword) {
                                    ThreeDotsLoader(
                                        dotSize = 8.dp,
                                        dotColor = Color.White,
                                        spaceBetween = 6.dp,
                                        travelDistance = 6.dp
                                    )
                                } else {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(imageVector = Icons.Default.Lock, contentDescription = "Change Password", tint = Color.White, modifier = Modifier.size(16.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(text = "Update Password", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    OutlinedButton(
                        onClick = onLogoutClick,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Logout, contentDescription = "Logout", tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "Log Out", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                }
            }

            TopFlashBanner(
                flashMessage = flashMessage,
                onDismiss = { flashMessage = null },
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
    }
}

@Composable
private fun ProfileInfoRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(imageVector = icon, contentDescription = label, tint = SunsetOrange, modifier = Modifier.size(16.dp))
        Spacer(modifier = Modifier.width(10.dp))
        Column {
            Text(text = label, fontSize = 10.5.sp, color = TextSecondary)
            Text(text = value, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
        }
    }
}

@Composable
private fun PasswordField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    isVisible: Boolean,
    onToggleVisibility: () -> Unit
) {
    Column {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextSecondary,
            modifier = Modifier.padding(bottom = 6.dp)
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Enter $label", color = TextSecondary, fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = label, tint = SunsetOrange) },
            trailingIcon = {
                IconButton(onClick = onToggleVisibility) {
                    Icon(
                        imageVector = if (isVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                        contentDescription = "Toggle Visibility",
                        tint = TextSecondary
                    )
                }
            },
            visualTransformation = if (isVisible) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = DarkCanvas.copy(alpha = 0.5f),
                unfocusedContainerColor = DarkCanvas.copy(alpha = 0.5f),
                focusedBorderColor = SunsetOrange,
                unfocusedBorderColor = CardBorder,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary
            )
        )
    }
}
