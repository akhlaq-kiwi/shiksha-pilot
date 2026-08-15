package com.shikshapilot.nativeapp.features.schooladmin.screens

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.School
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.SchoolProfileDto
import com.shikshapilot.nativeapp.data.remote.UpdateSchoolProfileRequestDto
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
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream

/**
 * Backend: GET/POST api/school/profile (SchoolAdminService::getSchoolProfile/updateSchoolProfile
 * — `schools` table row + active subscription snapshot), POST/DELETE api/school/profile/logo and
 * api/school/profile/signature (multipart upload, field key is arbitrary — controller does
 * `array_key_first($uploadedFiles)`; max 5MB, png/jpg/jpeg only). This is a distinct screen from
 * `SettingsScreen.kt` (which only handles the logged-in user's own password change) — this one is
 * the school's institutional profile (address, board affiliation, term dates, logo, signature).
 */
@Composable
fun SchoolAdminProfileScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var profile by remember { mutableStateOf<SchoolProfileDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }
    var isUploadingLogo by remember { mutableStateOf(false) }
    var isUploadingSignature by remember { mutableStateOf(false) }
    var reloadKey by remember { mutableStateOf(0) }

    var name by remember { mutableStateOf("") }
    var contactPhone by remember { mutableStateOf("") }
    var contactEmail by remember { mutableStateOf("") }
    var registrationNo by remember { mutableStateOf("") }
    var affiliationBoard by remember { mutableStateOf("") }
    var streetAddress by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    var pinCode by remember { mutableStateOf("") }

    fun applyProfile(p: SchoolProfileDto) {
        profile = p
        name = p.name ?: ""
        contactPhone = p.contact_phone ?: ""
        contactEmail = p.contact_email ?: ""
        registrationNo = p.registration_no ?: ""
        affiliationBoard = p.affiliation_board ?: ""
        streetAddress = p.street_address ?: ""
        city = p.city ?: ""
        state = p.state ?: ""
        pinCode = p.pin_code ?: ""
    }

    LaunchedEffect(reloadKey) {
        isLoading = true
        errorMessage = null
        try {
            val response = RetrofitClient.apiService.getSchoolProfile()
            if (response.isSuccessful && response.body()?.data != null) {
                applyProfile(response.body()!!.data!!)
            } else {
                errorMessage = "Unable to load school profile (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading profile"
        } finally {
            isLoading = false
        }
    }

    fun saveProfile() {
        isSaving = true
        scope.launch {
            try {
                val res = RetrofitClient.apiService.updateSchoolProfile(
                    UpdateSchoolProfileRequestDto(
                        name = name,
                        contact_phone = contactPhone,
                        contact_email = contactEmail,
                        registration_no = registrationNo,
                        affiliation_board = affiliationBoard,
                        street_address = streetAddress,
                        city = city,
                        state = state,
                        pin_code = pinCode
                    )
                )
                if (res.isSuccessful && res.body()?.data != null) {
                    applyProfile(res.body()!!.data!!)
                    Toast.makeText(context, "School profile updated", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(context, "Failed (code ${res.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                isSaving = false
            }
        }
    }

    fun uriToMultipart(uri: Uri, partName: String): MultipartBody.Part? {
        return try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return null
            val tempFile = File.createTempFile("upload", ".jpg", context.cacheDir)
            FileOutputStream(tempFile).use { output -> inputStream.copyTo(output) }
            val requestBody = tempFile.asRequestBody("image/*".toMediaTypeOrNull())
            MultipartBody.Part.createFormData(partName, tempFile.name, requestBody)
        } catch (e: Exception) {
            null
        }
    }

    val logoPickerLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val part = uriToMultipart(uri, "logo") ?: return@rememberLauncherForActivityResult
        isUploadingLogo = true
        scope.launch {
            try {
                val res = RetrofitClient.apiService.uploadSchoolLogo(part)
                if (res.isSuccessful && res.body()?.data != null) {
                    applyProfile(res.body()!!.data!!)
                    Toast.makeText(context, "Logo uploaded", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(context, "Upload failed (code ${res.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                isUploadingLogo = false
            }
        }
    }

    val signaturePickerLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val part = uriToMultipart(uri, "signature") ?: return@rememberLauncherForActivityResult
        isUploadingSignature = true
        scope.launch {
            try {
                val res = RetrofitClient.apiService.uploadPrincipalSignature(part)
                if (res.isSuccessful && res.body()?.data != null) {
                    applyProfile(res.body()!!.data!!)
                    Toast.makeText(context, "Signature uploaded", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(context, "Upload failed (code ${res.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                isUploadingSignature = false
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
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { reloadKey++ }) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(
                    schoolName = schoolName,
                    unreadNotificationCount = 2,
                    onNotificationClick = {},
                    onAvatarClick = {}
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 13.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
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
                        Text(text = "School Profile", fontSize = 15.5.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                        Text(text = "Logo, signature & school details", fontSize = 10.sp, color = SunsetOrange)
                    }
                }

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
                    else -> {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(horizontal = 16.dp)
                                .padding(bottom = 24.dp)
                        ) {
                            // Logo & Signature section
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                UploadTile(
                                    modifier = Modifier.weight(1f),
                                    label = "School Logo",
                                    hasFile = !profile?.logo_path.isNullOrBlank(),
                                    isUploading = isUploadingLogo,
                                    onUpload = { logoPickerLauncher.launch("image/*") },
                                    onRemove = {
                                        scope.launch {
                                            try {
                                                val res = RetrofitClient.apiService.removeSchoolLogo()
                                                if (res.isSuccessful && res.body()?.data != null) applyProfile(res.body()!!.data!!)
                                            } catch (_: Exception) { }
                                        }
                                    }
                                )
                                UploadTile(
                                    modifier = Modifier.weight(1f),
                                    label = "Principal Signature",
                                    hasFile = !profile?.principal_signature_path.isNullOrBlank(),
                                    isUploading = isUploadingSignature,
                                    onUpload = { signaturePickerLauncher.launch("image/*") },
                                    onRemove = {
                                        scope.launch {
                                            try {
                                                val res = RetrofitClient.apiService.removePrincipalSignature()
                                                if (res.isSuccessful && res.body()?.data != null) applyProfile(res.body()!!.data!!)
                                            } catch (_: Exception) { }
                                        }
                                    }
                                )
                            }

                            Spacer(modifier = Modifier.height(13.dp))

                            if (!profile?.active_plan.isNullOrBlank()) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(OnlineGreen.copy(alpha = 0.12f))
                                        .border(width = 1.dp, color = OnlineGreen.copy(alpha = 0.35f), shape = RoundedCornerShape(14.dp))
                                        .padding(12.dp)
                                ) {
                                    Column {
                                        Text(text = "Active Plan: ${profile?.active_plan}", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = OnlineGreen)
                                        if (!profile?.subscription_expiry.isNullOrBlank()) {
                                            Text(text = "Expires: ${profile?.subscription_expiry}", fontSize = 9.5.sp, color = TextSecondary)
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(13.dp))
                            }

                            ProfileField(label = "School Name", value = name, onChange = { name = it })
                            ProfileField(label = "Contact Phone", value = contactPhone, onChange = { contactPhone = it })
                            ProfileField(label = "Contact Email", value = contactEmail, onChange = { contactEmail = it })
                            ProfileField(label = "Registration No.", value = registrationNo, onChange = { registrationNo = it })
                            ProfileField(label = "Affiliation Board", value = affiliationBoard, onChange = { affiliationBoard = it })
                            ProfileField(label = "Street Address", value = streetAddress, onChange = { streetAddress = it })
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(modifier = Modifier.weight(1f)) { ProfileField(label = "City", value = city, onChange = { city = it }) }
                                Box(modifier = Modifier.weight(1f)) { ProfileField(label = "State", value = state, onChange = { state = it }) }
                            }
                            ProfileField(label = "Pin Code", value = pinCode, onChange = { pinCode = it })

                            Spacer(modifier = Modifier.height(8.dp))

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (isSaving) SunsetOrange.copy(alpha = 0.5f) else SunsetOrange)
                                    .clickable(enabled = !isSaving) { saveProfile() }
                                    .padding(vertical = 14.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = if (isSaving) "Saving..." else "Save Profile", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }
                }
            }
            }
        }
    }
}

@Composable
private fun ProfileField(label: String, value: String, onChange: (String) -> Unit) {
    Column(modifier = Modifier.padding(bottom = 12.dp)) {
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            label = { Text(label) },
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
        )
    }
}

@Composable
private fun UploadTile(
    modifier: Modifier = Modifier,
    label: String,
    hasFile: Boolean,
    isUploading: Boolean,
    onUpload: () -> Unit,
    onRemove: () -> Unit
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
            .padding(12.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Icon(imageVector = if (label.contains("Logo")) Icons.Default.School else Icons.Default.Image, contentDescription = label, tint = SunsetOrange, modifier = Modifier.size(23.dp))
            Spacer(modifier = Modifier.height(5.dp))
            Text(text = label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Text(text = if (hasFile) "Uploaded" else "Not set", fontSize = 9.sp, color = if (hasFile) OnlineGreen else TextSecondary)
            Spacer(modifier = Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(SunsetOrange.copy(alpha = 0.18f))
                        .clickable(enabled = !isUploading) { onUpload() }
                        .padding(horizontal = 8.dp, vertical = 5.dp)
                ) {
                    Text(text = if (isUploading) "..." else "Upload", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = SunsetOrange)
                }
                if (hasFile) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFEF4444).copy(alpha = 0.18f))
                            .clickable { onRemove() }
                            .padding(horizontal = 8.dp, vertical = 5.dp)
                    ) {
                        Text(text = "Remove", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
                    }
                }
            }
        }
    }
}
