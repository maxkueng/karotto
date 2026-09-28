package com.karotto.app.ui.common

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.material3.Text
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonPrimitive
import org.commonmark.node.Code
import org.commonmark.node.Emphasis
import org.commonmark.node.HardLineBreak
import org.commonmark.node.Link
import org.commonmark.node.Node
import org.commonmark.node.Paragraph
import org.commonmark.node.SoftLineBreak
import org.commonmark.node.StrongEmphasis
import org.commonmark.node.Text as MdText
import org.commonmark.parser.Parser

/** Emoji shortcodes shipped from the web client's markdown-it table. */
object Emoji {
    private var map: Map<String, String>? = null
    private val pattern = Regex(":([a-z0-9_+\\-]+):")

    fun load(context: Context): Map<String, String> = map ?: run {
        val text = context.assets.open("emoji.json").bufferedReader().readText()
        val parsed = Json.parseToJsonElement(text).let { element ->
            (element as kotlinx.serialization.json.JsonObject).mapValues { it.value.jsonPrimitive.content }
        }
        map = parsed
        parsed
    }

    fun replace(source: String, table: Map<String, String>): String =
        pattern.replace(source) { match -> table[match.groupValues[1]] ?: match.value }
}

/** Minimal inline markdown: emphasis, strong, code, links and emoji, as the task cards need. */
object Markdown {
    private val parser: Parser = Parser.builder().build()

    fun render(source: String, emoji: Map<String, String>, linkColor: Color): AnnotatedString {
        val document = parser.parse(Emoji.replace(source, emoji))
        return buildAnnotatedString { append(document, linkColor, first = true) }
    }

    private val urlPattern = Regex("""(https?://[^\s<>()\[\]]+[^\s<>()\[\].,;:!?'"])""")

    private fun androidx.compose.ui.text.AnnotatedString.Builder.appendAutolinked(text: String, linkColor: Color) {
        var last = 0
        urlPattern.findAll(text).forEach { match ->
            append(text.substring(last, match.range.first))
            withLink(
                LinkAnnotation.Url(
                    match.value,
                    TextLinkStyles(SpanStyle(color = linkColor, textDecoration = TextDecoration.Underline)),
                ),
            ) { append(match.value) }
            last = match.range.last + 1
        }
        append(text.substring(last))
    }

    private fun androidx.compose.ui.text.AnnotatedString.Builder.append(node: Node, linkColor: Color, first: Boolean) {
        var child = node.firstChild
        var firstBlock = first
        while (child != null) {
            when (child) {
                is MdText -> appendAutolinked(child.literal, linkColor)
                is SoftLineBreak -> append(' ')
                is HardLineBreak -> append('\n')
                is Emphasis -> withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(child, linkColor, false) }
                is StrongEmphasis -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(child, linkColor, false) }
                is Code -> withStyle(SpanStyle(fontFamily = FontFamily.Monospace)) { append(child.literal) }
                is Link -> withLink(
                    LinkAnnotation.Url(
                        child.destination,
                        TextLinkStyles(SpanStyle(color = linkColor, textDecoration = TextDecoration.Underline)),
                    ),
                ) { append(child, linkColor, false) }
                is Paragraph -> {
                    if (!firstBlock) append('\n')
                    firstBlock = false
                    append(child, linkColor, false)
                }
                else -> append(child, linkColor, false)
            }
            child = child.next
        }
    }
}

@Composable
fun MarkdownText(
    source: String,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    maxLines: Int = Int.MAX_VALUE,
) {
    val context = LocalContext.current
    val emoji = remember { Emoji.load(context) }
    val linkColor = com.karotto.app.ui.theme.KarottoTheme.colors.textBrand
    val text = remember(source, linkColor) { Markdown.render(source, emoji, linkColor) }
    Text(text = text, style = style, color = color, modifier = modifier, maxLines = maxLines)
}

@Composable
fun rememberUriOpener(): (String) -> Unit {
    val handler = LocalUriHandler.current
    return { url -> runCatching { handler.openUri(url) } }
}
