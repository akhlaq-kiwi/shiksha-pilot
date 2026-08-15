package com.shikshapilot.nativeapp.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.R
import com.shikshapilot.nativeapp.data.remote.LoginRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.FlashMessage
import com.shikshapilot.nativeapp.ui.components.FlashMessageType
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
fun LoginScreen(
    onLoginSuccess: (phone: String, roleName: String, schoolName: String) -> Unit
) {
    var phone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isPasswordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var flashMessage by remember { mutableStateOf<FlashMessage?>(null) }

    val focusRequesterPassword = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current
    val coroutineScope = rememberCoroutineScope()

    val submitForm = {
        val cleanPhone = phone.trim()
        val cleanPassword = password.trim()

        if (cleanPhone.length < 10) {
            flashMessage = FlashMessage(
                message = "Mobile number must be exactly 10 digits",
                type = FlashMessageType.ERROR
            )
        } else if (cleanPassword.isEmpty()) {
            flashMessage = FlashMessage(
                message = "Password is required",
                type = FlashMessageType.ERROR
            )
        } else {
            keyboardController?.hide()
            isLoading = true
            flashMessage = null

            coroutineScope.launch {
                try {
                    val response = RetrofitClient.apiService.login(
                        LoginRequestDto(cleanPhone, cleanPassword)
                    )
                    isLoading = false
                    if (response.isSuccessful && response.body()?.data != null) {
                        val loginData = response.body()!!.data!!
                        RetrofitClient.authToken = loginData.token
                        val u = loginData.user
                        onLoginSuccess(
                            u.phone,
                            u.role,
                            u.school_name ?: "Jamiya Kids Planet Academy"
                        )
                    } else {
                        flashMessage = FlashMessage(
                            message = response.body()?.message
                                ?: "Invalid mobile number or password credentials",
                            type = FlashMessageType.ERROR
                        )
                    }
                } catch (e: Exception) {
                    isLoading = false
                    flashMessage = FlashMessage(
                        message = "Unable to sign in. Please check your connection and try again.",
                        type = FlashMessageType.ERROR
                    )
                }
            }
        }
    }

    Scaffold(
        containerColor = DarkCanvas
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            // Light Orange Blurred Glow Spot shifted 20% higher up
            Box(
                modifier = Modifier
                    .size(352.dp)
                    .align(BiasAlignment(0f, -0.4f))
                    .background(
                        brush = Brush.radialGradient(
                            colors = listOf(
                                SunsetOrange.copy(alpha = 0.25f),
                                Color.Transparent
                            )
                        ),
                        shape = CircleShape
                    )
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Spacer(modifier = Modifier.height(32.dp))

                // Exact Logo Image Container
                Box(
                    modifier = Modifier
                        .size(77.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(SunsetOrange.copy(alpha = 0.15f))
                        .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.4f), shape = RoundedCornerShape(24.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_launcher),
                        contentDescription = "ShikshaPilot Exact Logo",
                        modifier = Modifier
                            .size(60.dp)
                            .clip(RoundedCornerShape(18.dp))
                    )
                }

                Spacer(modifier = Modifier.height(13.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Shiksha",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Black,
                        color = TextPrimary
                    )
                    Text(
                        text = "Pilot",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Black,
                        color = SunsetOrange
                    )
                }

                Text(
                    text = "Empowering Education & Governance",
                    fontSize = 11.sp,
                    color = TextSecondary,
                    modifier = Modifier.padding(top = 4.dp)
                )

                Spacer(modifier = Modifier.height(29.dp))

                // Glassmorphic Login Card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(28.dp))
                        .background(FrostedCard.copy(alpha = 0.85f))
                        .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(28.dp))
                        .padding(24.dp)
                ) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = "Welcome Back",
                            fontSize = 18.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "Sign in to access your dashboard",
                            fontSize = 11.sp,
                            color = TextSecondary,
                            modifier = Modifier.padding(top = 4.dp, bottom = 20.dp)
                        )

                        // Mobile Number Input
                        Text(
                            text = "Mobile Number",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextSecondary,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )
                        OutlinedTextField(
                            value = phone,
                            onValueChange = { input ->
                                if (input.length <= 10 && input.all { it.isDigit() }) {
                                    phone = input
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            placeholder = { Text("Enter 10-digit mobile number", color = TextSecondary, fontSize = 12.sp) },
                            leadingIcon = { Icon(Icons.Default.Phone, contentDescription = "Phone", tint = SunsetOrange) },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Number,
                                imeAction = ImeAction.Next
                            ),
                            keyboardActions = KeyboardActions(
                                onNext = { focusRequesterPassword.requestFocus() }
                            ),
                            singleLine = true,
                            shape = RoundedCornerShape(16.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = DarkCanvas.copy(alpha = 0.5f),
                                unfocusedContainerColor = DarkCanvas.copy(alpha = 0.5f),
                                focusedBorderColor = SunsetOrange,
                                unfocusedBorderColor = CardBorder,
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary
                            )
                        )

                        Spacer(modifier = Modifier.height(13.dp))

                        // Password Input
                        Text(
                            text = "Password",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextSecondary,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            modifier = Modifier
                                .fillMaxWidth()
                                .focusRequester(focusRequesterPassword),
                            placeholder = { Text("Enter password", color = TextSecondary, fontSize = 12.sp) },
                            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = "Password", tint = SunsetOrange) },
                            trailingIcon = {
                                IconButton(onClick = { isPasswordVisible = !isPasswordVisible }) {
                                    Icon(
                                        imageVector = if (isPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                        contentDescription = "Toggle Password",
                                        tint = TextSecondary
                                    )
                                }
                            },
                            visualTransformation = if (isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = { submitForm() }
                            ),
                            singleLine = true,
                            shape = RoundedCornerShape(16.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = DarkCanvas.copy(alpha = 0.5f),
                                unfocusedContainerColor = DarkCanvas.copy(alpha = 0.5f),
                                focusedBorderColor = SunsetOrange,
                                unfocusedBorderColor = CardBorder,
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary
                            )
                        )

                        Spacer(modifier = Modifier.height(19.dp))

                        // Sunset Orange Login Button with 3 Dots Loader
                        Button(
                            onClick = { submitForm() },
                            enabled = !isLoading,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                        ) {
                            if (isLoading) {
                                ThreeDotsLoader(
                                    dotSize = 9.dp,
                                    dotColor = Color.White,
                                    spaceBetween = 6.dp,
                                    travelDistance = 6.dp
                                )
                            } else {
                                Text(
                                    text = "Sign In",
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(19.dp))

                Text(
                    text = "© 2026 ShikshaPilot. All rights reserved.",
                    fontSize = 9.5.sp,
                    color = TextSecondary
                )
            }

            // App-Wide Reusable Top Flash Banner Component
            TopFlashBanner(
                flashMessage = flashMessage,
                onDismiss = { flashMessage = null },
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
    }
}
