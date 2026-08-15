package com.shikshapilot.nativeapp.ui.components

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary

data class ChartPointData(
    val label: String, // e.g. "Apr", "May"
    val value: Float,  // numeric value for height calculation
    val formattedValue: String // e.g. "₹ 2.4L"
)

@Composable
fun MonthlyLineChartCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    lineColor: Color,
    chartData: List<ChartPointData>
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(FrostedCard.copy(alpha = 0.9f))
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(24.dp))
            .padding(18.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(lineColor.copy(alpha = 0.18f))
                            .border(width = 1.dp, color = lineColor.copy(alpha = 0.35f), shape = RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(imageVector = icon, contentDescription = title, tint = lineColor, modifier = Modifier.size(20.dp))
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(text = title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Text(text = subtitle, fontSize = 11.5.sp, color = TextSecondary)
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Canvas Chart Container
            if (chartData.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(130.dp)
                        .background(Color.Black.copy(alpha = 0.2f), shape = RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "No financial data recorded yet", fontSize = 12.sp, color = TextSecondary)
                }
            } else {
                val maxValue = (chartData.maxOfOrNull { it.value } ?: 1f).coerceAtLeast(1f)

                Column(modifier = Modifier.fillMaxWidth()) {
                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(130.dp)
                    ) {
                        val width = size.width
                        val height = size.height
                        val paddingX = 24.dp.toPx()
                        val paddingY = 16.dp.toPx()
                        val usableWidth = width - (paddingX * 2)
                        val usableHeight = height - (paddingY * 2)

                        val points = chartData.mapIndexed { index, item ->
                            val x = paddingX + (index.toFloat() / (chartData.size - 1).coerceAtLeast(1)) * usableWidth
                            val normalizedY = item.value / maxValue
                            val y = height - paddingY - (normalizedY * usableHeight)
                            Offset(x, y)
                        }

                        // Gradient Fill Path Under Line
                        val fillPath = Path().apply {
                            if (points.isNotEmpty()) {
                                moveTo(points.first().x, height - paddingY)
                                points.forEach { lineTo(it.x, it.y) }
                                lineTo(points.last().x, height - paddingY)
                                close()
                            }
                        }

                        drawPath(
                            path = fillPath,
                            brush = Brush.verticalGradient(
                                colors = listOf(
                                    lineColor.copy(alpha = 0.35f),
                                    lineColor.copy(alpha = 0.02f)
                                )
                            )
                        )

                        // Line Stroke Path
                        val strokePath = Path().apply {
                            if (points.isNotEmpty()) {
                                moveTo(points.first().x, points.first().y)
                                for (i in 0 until points.size - 1) {
                                    val current = points[i]
                                    val next = points[i + 1]
                                    val controlX = (current.x + next.x) / 2f
                                    cubicTo(controlX, current.y, controlX, next.y, next.x, next.y)
                                }
                            }
                        }

                        drawPath(
                            path = strokePath,
                            color = lineColor,
                            style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
                        )

                        // Data Point Circles & Outer Rings
                        points.forEach { pt ->
                            drawCircle(
                                color = lineColor,
                                radius = 5.dp.toPx(),
                                center = pt
                            )
                            drawCircle(
                                color = Color.White,
                                radius = 2.5.dp.toPx(),
                                center = pt
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Month X-Axis Labels Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        chartData.forEach { item ->
                            Text(
                                text = item.label,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextSecondary
                            )
                        }
                    }
                }
            }
        }
    }
}
