/**
 * dsh-trend-radar — browser face: an ecosystem trend dashboard panel stacked
 * above the composer, rendered from the `trendBoard` session projection
 * (growth curve, category heat, top new plugins, star gainers).
 *
 * EXPERIMENTAL: this hand-written module mirrors the loader format emitted by
 * the in-repo client bundles (window.__ModuleLoader__.load with a CommonJS
 * factory). It is served to the browser on demand via the client-modules
 * roster (/plugins/<id>/client.js) when this package's composition row is
 * mounted on a web profile. React is required through the app's module
 * table; no JSX, no bundler, no TS.
 */
window.__ModuleLoader__.load({
  id: "dsh-trend-radar/client",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");

    var cssId = "dsh-trend-radar/client";
    var css = [
      ".dshrd-dock{box-sizing:border-box;width:100%;max-width:calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset));margin:0 auto;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:12px;padding:10px 14px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary)}",
      ".dshrd-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px}",
      ".dshrd-title{font-weight:600;color:var(--dsw-alias-label-secondary)}",
      ".dshrd-stat{color:var(--dsw-alias-label-caption)}",
      ".dshrd-chart{margin-bottom:8px}",
      ".dshrd-chart svg{display:block;width:100%;height:56px}",
      ".dshrd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}",
      ".dshrd-col h4{margin:0 0 4px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-caption)}",
      ".dshrd-list{margin:0;padding:0;list-style:none;max-height:120px;overflow:auto}",
      ".dshrd-list li{display:flex;gap:6px;justify-content:space-between;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".dshrd-list li b{font-weight:500;overflow:hidden;text-overflow:ellipsis}",
      ".dshrd-list li span{color:var(--dsw-alias-label-caption);flex-shrink:0}",
      ".dshrd-heat{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;margin-top:2px}",
      ".dshrd-heat .bar{height:6px;border-radius:3px;background:var(--dsw-alias-border-l2);overflow:hidden}",
      ".dshrd-heat .bar i{display:block;height:100%;border-radius:3px;background:var(--dsw-alias-brand-primary);opacity:.75}",
      ".dshrd-heat span{color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums}",
      ".dshrd-empty{color:var(--dsw-alias-label-caption)}",
      ".dshrd-foot{margin-top:8px;color:var(--dsw-alias-label-caption);font-size:11px}",
    ].join("");
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"" + cssId + "\"]") === null) {
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-trend-radar";
      tag.dataset.pluginCss = cssId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    /** Polyline points for the growth curve (repo count over snapshots). */
    function polylinePoints(series, w, h) {
      if (!series || series.length === 0) return "";
      var counts = series.map(function (s) { return s.count; });
      var min = Math.min.apply(null, counts);
      var max = Math.max.apply(null, counts);
      var span = max - min || 1;
      var pad = 4;
      return series.map(function (s, i) {
        var x = series.length === 1 ? w / 2 : pad + (i / (series.length - 1)) * (w - 2 * pad);
        var y = h - pad - ((s.count - min) / span) * (h - 2 * pad);
        return x.toFixed(1) + "," + y.toFixed(1);
      }).join(" ");
    }

    /** Ecosystem trend dashboard: growth curve + category heat + top lists. */
    function TrendPanel(props) {
      var useProjection = props.useProjection;
      var projection = useProjection("trendBoard");
      if (projection == null) {
        return react.createElement(
          "div",
          { className: "dshrd-dock", "data-trend-panel": true },
          react.createElement("div", { className: "dshrd-title" }, "Ecosystem trends"),
          react.createElement("div", { className: "dshrd-empty" }, "No trend data yet — ask the agent to run trend_snapshot / trend_report.")
        );
      }
      var points = polylinePoints(projection.series, 300, 56);
      var heatMax = projection.categoryHeat.reduce(function (m, c) { return Math.max(m, c.count); }, 1);
      return react.createElement(
        "div",
        { className: "dshrd-dock", "data-trend-panel": true },
        react.createElement(
          "div",
          { className: "dshrd-head" },
          react.createElement("span", { className: "dshrd-title" }, "Ecosystem trends"),
          react.createElement("span", { className: "dshrd-stat" }, projection.snapshots + " snapshots"),
          react.createElement("span", { className: "dshrd-stat" }, projection.total + " repos"),
          react.createElement("span", { className: "dshrd-stat" }, Math.round(projection.awesomeCoverage * 100) + "% on awesome")
        ),
        react.createElement(
          "div",
          { className: "dshrd-chart" },
          react.createElement("svg", { viewBox: "0 0 300 56", preserveAspectRatio: "none", "aria-hidden": true },
            react.createElement("polyline", { points: points, fill: "none", stroke: "var(--dsw-alias-brand-primary)", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" })
          )
        ),
        react.createElement(
          "div",
          { className: "dshrd-grid" },
          react.createElement(
            "div",
            { className: "dshrd-col" },
            react.createElement("h4", null, "New plugins"),
            react.createElement(
              "ul",
              { className: "dshrd-list" },
              projection.newPlugins.map(function (p) {
                return react.createElement("li", { key: p.name, title: p.desc },
                  react.createElement("b", null, p.name),
                  react.createElement("span", null, p.stars + "★")
                );
              })
            )
          ),
          react.createElement(
            "div",
            { className: "dshrd-col" },
            react.createElement("h4", null, "Star gainers"),
            react.createElement(
              "ul",
              { className: "dshrd-list" },
              projection.starGainers.map(function (g) {
                return react.createElement("li", { key: g.name },
                  react.createElement("b", null, g.name),
                  react.createElement("span", null, "+" + g.delta)
                );
              })
            )
          ),
          react.createElement(
            "div",
            { className: "dshrd-col" },
            react.createElement("h4", null, "Category heat"),
            react.createElement(
              "div",
              { className: "dshrd-heat" },
              projection.categoryHeat.map(function (c) {
                return react.createElement(react.Fragment, { key: c.category },
                  react.createElement("span", null, c.category),
                  react.createElement("div", { className: "bar" },
                    react.createElement("i", { style: { width: Math.round((c.count / heatMax) * 100) + "%" } })
                  ),
                  react.createElement("span", null, c.count)
                );
              })
            )
          )
        ),
        react.createElement("div", { className: "dshrd-foot" }, "Updated " + new Date(projection.ts).toLocaleString() + " — data from the local snapshot history (dsh-trend-radar).")
      );
    }

    /** Browser plugin body: register the dashboard into the composer dock. */
    function apply(ctx) {
      ctx.slots.inject("conversation.input.dock", function () {
        return ctx.slots.register({
          name: "conversation.input.dock",
          id: "trend-radar",
          order: 10,
        }, TrendPanel);
      });
    }

    exports.name = "trend-radar-ui";
    exports.apply = apply;
    exports.inject = ["@deepseek-ai/dsh-client-runtime"];
    return module.exports;
  },
});