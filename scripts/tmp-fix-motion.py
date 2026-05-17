from pathlib import Path

p = Path("src/app/watchlist/ui/watchlist-console.tsx")
t = p.read_text()
open_tag = "<" + "motion" + ' className="xf-watchlist-desk-refresh-cluster"'
close_tag = "</" + "motion" + ">"
t = t.replace(open_tag, "<motion className=\"xf-watchlist-desk-refresh-cluster\"".replace("motion", "motion"))
# still wrong - just use div directly as separate chars
t = t.replace("<motion className=\"xf-watchlist-desk-refresh-cluster\"", "<div className=\"xf-watchlist-desk-refresh-cluster\"")
t = t.replace("</motion>", "</div>", 1)
p.write_text(t)
print("done", "<motion" in p.read_text())
