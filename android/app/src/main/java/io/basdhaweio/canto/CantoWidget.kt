package io.basdhaweio.canto

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Home-screen flashcards. The page sends a deck (due cards first, then new ones) plus a summary after every change
// (MainActivity.Bridge.widget), so the widget works with no network. Tapping the card flips it; Skip moves on;
// Again / Hard / Good are kept in WidgetStore and handed to the page the next time Canto opens, which schedules them
// exactly as if they'd been graded in the app (XP, quests and the streak included).
class CantoWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        render(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_FLIP -> WidgetStore.flip(context)
            ACTION_SKIP -> WidgetStore.skip(context)
            ACTION_GRADE -> WidgetStore.grade(context, intent.getIntExtra(EXTRA_GRADE, 2))
            else -> return
        }
        render(context)
    }

    // No onAppWidgetOptionsChanged: some launchers (Samsung) fire it after every redraw, and redrawing in response
    // made the Library widget blink. The layout is the same at any size anyway.

    companion object {
        const val ACTION_FLIP = "io.basdhaweio.canto.FLIP"
        const val ACTION_SKIP = "io.basdhaweio.canto.SKIP"
        const val ACTION_GRADE = "io.basdhaweio.canto.GRADE"
        const val EXTRA_GRADE = "g"

        fun render(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, CantoWidget::class.java))
            if (ids.isEmpty()) return
            val views = build(ctx)
            for (id in ids) mgr.updateAppWidget(id, views)
        }

        private fun build(ctx: Context): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_canto)
            v.setOnClickPendingIntent(R.id.header, open(ctx, 1, "#/"))
            v.setOnClickPendingIntent(R.id.btn_show, action(ctx, 10, ACTION_FLIP))
            v.setOnClickPendingIntent(R.id.btn_skip, action(ctx, 11, ACTION_SKIP))
            v.setOnClickPendingIntent(R.id.btn_again, grade(ctx, 0))
            v.setOnClickPendingIntent(R.id.btn_hard, grade(ctx, 1))
            v.setOnClickPendingIntent(R.id.btn_good, grade(ctx, 2))

            val s = WidgetStore.deck(ctx)
            if (s == null) {
                v.setTextViewText(R.id.streak, "粵 Canto")
                v.setTextViewText(R.id.level, "")
                empty(ctx, v, "Open Canto once", "and your cards appear here")
                v.setTextViewText(R.id.status, "tap to open Canto")
                return v
            }

            val freezes = s.optInt("freezes")
            v.setTextViewText(R.id.streak, "🔥 " + s.optInt("streak") + (if (freezes > 0) " " + "❄".repeat(freezes) else ""))
            v.setTextViewText(R.id.level, "Lv " + s.optInt("level") + " · " + s.optString("title"))
            v.setProgressBar(R.id.xp_bar, 1000, (s.optDouble("pct", 0.0) * 1000).toInt(), false)

            val left = WidgetStore.remaining(ctx)
            val pending = WidgetStore.pendingCount(ctx)
            val card = WidgetStore.current(ctx)
            if (card == null) {
                empty(ctx, v, "All done here ✓", if (pending > 0) "Open Canto to save $pending grade" + (if (pending == 1) "" else "s") else "Open Canto for more")
            } else {
                val flipped = WidgetStore.flipped(ctx)
                v.setOnClickPendingIntent(R.id.card, action(ctx, 12, ACTION_FLIP))
                v.setTextViewText(R.id.tag, card.optString("tag"))
                v.setTextViewText(R.id.front1, card.optString("f1"))
                v.setTextViewText(R.id.front2, card.optString("f2"))
                v.setViewVisibility(R.id.front2, if (card.optString("f2").isEmpty()) View.GONE else View.VISIBLE)
                v.setTextViewText(R.id.back1, card.optString("b1"))
                v.setTextViewText(R.id.back2, card.optString("b2"))
                v.setViewVisibility(R.id.back1, if (flipped) View.VISIBLE else View.GONE)
                v.setViewVisibility(R.id.back2, if (flipped && card.optString("b2").isNotEmpty()) View.VISIBLE else View.GONE)
                v.setViewVisibility(R.id.row_front, if (flipped) View.GONE else View.VISIBLE)
                v.setViewVisibility(R.id.row_back, if (flipped) View.VISIBLE else View.GONE)
            }

            val at = s.optLong("at")
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            val stale = s.optString("date") != today
            v.setTextViewText(
                R.id.status,
                "$left left" + (if (pending > 0) " · $pending to save" else "") +
                    (if (stale) " · open Canto for today's cards" else if (at > 0) " · updated " + SimpleDateFormat("h:mm a", Locale.US).format(Date(at)) else "")
            )
            return v
        }

        private fun empty(ctx: Context, v: RemoteViews, title: String, sub: String) {
            v.setOnClickPendingIntent(R.id.card, open(ctx, 2, "#/review"))
            v.setTextViewText(R.id.tag, "")
            v.setTextViewText(R.id.front1, title)
            v.setTextViewText(R.id.front2, sub)
            v.setViewVisibility(R.id.front2, View.VISIBLE)
            v.setViewVisibility(R.id.back1, View.GONE)
            v.setViewVisibility(R.id.back2, View.GONE)
            v.setViewVisibility(R.id.row_front, View.GONE)
            v.setViewVisibility(R.id.row_back, View.GONE)
        }

        private fun action(ctx: Context, code: Int, what: String): PendingIntent {
            val i = Intent(ctx, CantoWidget::class.java).setAction(what)
            return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        private fun grade(ctx: Context, g: Int): PendingIntent {
            val i = Intent(ctx, CantoWidget::class.java).setAction(ACTION_GRADE).putExtra(EXTRA_GRADE, g)
            return PendingIntent.getBroadcast(ctx, 20 + g, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        private fun open(ctx: Context, code: Int, hash: String): PendingIntent {
            val i = Intent(ctx, MainActivity::class.java)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse(LIVE_URL + hash))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
    }
}

// The deck the page last sent, where the widget is in it, and grades waiting for the page (see js/native.js).
object WidgetStore {
    private const val FILE = "widget"
    private const val DECK = "deck"
    private const val POS = "pos"
    private const val FLIPPED = "flipped"
    private const val DONE = "done"
    private const val PENDING = "pending"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    @Synchronized
    fun saveDeck(ctx: Context, json: String) {
        // A new deck from the page starts fresh, but anything graded here and not yet handed over stays hidden.
        val waiting = pendingKeys(ctx)
        prefs(ctx).edit().putString(DECK, json).putInt(POS, 0).putBoolean(FLIPPED, false)
            .putStringSet(DONE, waiting).apply()
    }

    fun deck(ctx: Context): JSONObject? {
        val raw = prefs(ctx).getString(DECK, null) ?: return null
        return try { JSONObject(raw) } catch (e: Exception) { null }
    }

    private fun open(ctx: Context): List<JSONObject> {
        val cards = deck(ctx)?.optJSONArray("cards") ?: return emptyList()
        val done = prefs(ctx).getStringSet(DONE, emptySet()) ?: emptySet()
        val out = ArrayList<JSONObject>()
        for (i in 0 until cards.length()) {
            val c = cards.optJSONObject(i) ?: continue
            if (!done.contains(c.optString("k"))) out.add(c)
        }
        return out
    }

    fun remaining(ctx: Context) = open(ctx).size

    fun current(ctx: Context): JSONObject? {
        val list = open(ctx)
        if (list.isEmpty()) return null
        return list[prefs(ctx).getInt(POS, 0).mod(list.size)]
    }

    fun flipped(ctx: Context) = prefs(ctx).getBoolean(FLIPPED, false)

    @Synchronized
    fun flip(ctx: Context) {
        if (current(ctx) == null) return
        prefs(ctx).edit().putBoolean(FLIPPED, !flipped(ctx)).apply()
    }

    @Synchronized
    fun skip(ctx: Context) {
        val n = remaining(ctx)
        if (n == 0) return
        prefs(ctx).edit().putInt(POS, (prefs(ctx).getInt(POS, 0) + 1).mod(n)).putBoolean(FLIPPED, false).apply()
    }

    @Synchronized
    fun grade(ctx: Context, g: Int) {
        val card = current(ctx) ?: return
        val key = card.optString("k")
        val list = pendingArray(ctx)
        list.put(JSONObject().put("k", key).put("g", g)
            .put("d", SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())).put("t", System.currentTimeMillis()))
        val done = HashSet(prefs(ctx).getStringSet(DONE, emptySet()) ?: emptySet())
        done.add(key)
        // POS stays put: the next card slides into this spot. Again cards are left for the app's own review today.
        prefs(ctx).edit().putString(PENDING, list.toString()).putStringSet(DONE, done).putBoolean(FLIPPED, false).apply()
    }

    private fun pendingArray(ctx: Context): JSONArray =
        try { JSONArray(prefs(ctx).getString(PENDING, "[]")) } catch (e: Exception) { JSONArray() }

    fun pendingCount(ctx: Context) = pendingArray(ctx).length()

    private fun pendingKeys(ctx: Context): Set<String> {
        val a = pendingArray(ctx)
        val out = HashSet<String>()
        for (i in 0 until a.length()) a.optJSONObject(i)?.optString("k")?.let { out.add(it) }
        return out
    }

    @Synchronized
    fun takePending(ctx: Context): String {
        val raw = pendingArray(ctx).toString()
        prefs(ctx).edit().putString(PENDING, "[]").apply()
        CantoWidget.render(ctx)
        return raw
    }
}
