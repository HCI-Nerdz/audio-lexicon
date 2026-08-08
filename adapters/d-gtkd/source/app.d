module app;

import std.file : exists, readText;
import std.json;
import std.path : buildNormalizedPath, dirName;
import std.process : environment;
import std.stdio : writeln;
import std.string : replace;

import gtk.Main;
import gtk.MainWindow;
import gtk.Box;
import gtk.Paned;
import gtk.ScrolledWindow;
import gtk.TreeStore;
import gtk.TreeView;
import gtk.TreeViewColumn;
import gtk.TreeIter;
import gtk.CellRendererText;
import gtk.Label;
import gtk.TextView;
import gtk.Entry;
import gtk.Scale;
import gtk.Button;
import gtk.Orientation;
import gtk.PolicyType;
import gtk.Range;
import gtk.WrapMode;
import gtk.AboutDialog;
import gtkc.gtktypes : GtkLicense;

string catalogPath()
{
    if (auto p = environment.get("AUDIO_LEXICON_CATALOG", null))
        return p;
    // adapters/d-gtkd/source -> repo root
    return buildNormalizedPath(dirName(__FILE__), "..", "..", "..", "catalog", "lexicon.json");
}

class LexiconApp : MainWindow
{
    JSONValue lex;
    TreeStore store;
    TreeView tree;
    Label titleLbl;
    TextView detail;
    TextView exportView;
    Box controlsBox;
    string selectedId;
    double[string] params;

    this()
    {
        super("audio-lexicon (GtkD)");
        setDefaultSize(1100, 720);
        auto path = catalogPath();
        if (!exists(path))
            throw new Exception("Catalog not found: " ~ path);
        lex = parseJSON(readText(path));

        auto root = new Box(Orientation.VERTICAL, 6);
        root.setBorderWidth(8);
        root.packStart(new Label("HCI Nerdz · Audio lexicon (D/GtkD)"), false, false, 0);

        auto paned = new Paned(Orientation.HORIZONTAL);
        paned.add1(buildSidebar());
        paned.add2(buildMain());
        paned.setPosition(280);
        root.packStart(paned, true, true, 0);

        auto aboutBtn = new Button("About / version");
        aboutBtn.addOnClicked(delegate void(Button) {
            auto dlg = new AboutDialog();
            dlg.setProgramName("audio-lexicon");
            dlg.setVersion(lex["version"].str);
            dlg.setComments("Pro-audio literacy UI — GtkD adapter.");
            dlg.setLicenseType(GtkLicense.MIT_X11);
            dlg.run();
            dlg.destroy();
        });
        root.packStart(aboutBtn, false, false, 0);
        add(root);
        showAll();
        if ("home" in lex["terms"].object)
            selectTerm("home");
        else if ("peaking-eq" in lex["terms"].object)
            selectTerm("peaking-eq");
    }

    auto buildSidebar()
    {
        auto box = new Box(Orientation.VERTICAL, 4);
        auto search = new Entry();
        search.setPlaceholderText("Search…");
        search.addOnChanged(delegate void(EditableIF) { rebuildTree(search.getText()); });
        box.packStart(search, false, false, 0);

        store = new TreeStore([GType.STRING, GType.STRING]);
        tree = new TreeView(store);
        tree.appendColumn(new TreeViewColumn("Term", new CellRendererText(), "text", 0));
        tree.addOnCursorChanged(delegate void(TreeView) {
            TreeIter iter = tree.getSelectedIter();
            if (iter is null)
                return;
            auto id = store.getValue(iter, 1).getString();
            if (id.length)
                selectTerm(id);
        });
        rebuildTree("");
        auto scroll = new ScrolledWindow();
        scroll.setPolicy(PolicyType.AUTOMATIC, PolicyType.AUTOMATIC);
        scroll.add(tree);
        box.packStart(scroll, true, true, 0);
        return box;
    }

    auto buildMain()
    {
        auto box = new Box(Orientation.VERTICAL, 8);
        titleLbl = new Label("Select a term");
        titleLbl.setXalign(0);
        box.packStart(titleLbl, false, false, 0);

        detail = new TextView();
        detail.setEditable(false);
        detail.setWrapMode(WrapMode.WORD_CHAR);
        auto dscroll = new ScrolledWindow();
        dscroll.setPolicy(PolicyType.AUTOMATIC, PolicyType.AUTOMATIC);
        dscroll.add(detail);
        box.packStart(dscroll, true, true, 0);

        controlsBox = new Box(Orientation.VERTICAL, 4);
        box.packStart(controlsBox, false, false, 0);

        exportView = new TextView();
        exportView.setEditable(false);
        exportView.setWrapMode(WrapMode.WORD_CHAR);
        auto escroll = new ScrolledWindow();
        escroll.setPolicy(PolicyType.AUTOMATIC, PolicyType.AUTOMATIC);
        escroll.add(exportView);
        box.packStart(new Label("Export"), false, false, 0);
        box.packStart(escroll, false, true, 0);
        return box;
    }

    void rebuildTree(string query)
    {
        store.clear();
        import std.string : toLower;
        import std.algorithm : canFind;
        auto q = query.toLower;
        foreach (cat; lex["tree"].array)
        {
            if ("termId" in cat && cat["termId"].str.length)
            {
                auto termId = cat["termId"].str;
                auto label = cat["label"].str;
                if (q.length && !label.toLower.canFind(q) && !termId.toLower.canFind(q))
                    continue;
                TreeIter leaf = store.createIter();
                store.setValue(leaf, 0, label);
                store.setValue(leaf, 1, termId);
                continue;
            }
            TreeIter catIter = store.createIter();
            store.setValue(catIter, 0, cat["label"].str);
            store.setValue(catIter, 1, "");
            if ("children" !in cat)
                continue;
            foreach (child; cat["children"].array)
            {
                auto termId = child["termId"].str;
                auto label = child["label"].str;
                if (q.length && !label.toLower.canFind(q) && !termId.toLower.canFind(q))
                    continue;
                TreeIter leaf = store.append(catIter);
                store.setValue(leaf, 0, label);
                store.setValue(leaf, 1, termId);
            }
        }
        tree.expandAll();
    }

    void selectTerm(string id)
    {
        selectedId = id;
        auto term = lex["terms"][id];
        titleLbl.setText(term["name"].str);
        string body =
            "Summary: " ~ term["summary"].str ~ "\n\n" ~
            "Meaning: " ~ term["plainMeaning"].str ~ "\n\n" ~
            "History: " ~ term["history"].str ~ "\n\n" ~
            "When: " ~ term["whenToUse"].str ~ "\n\n" ~
            "Confusion: " ~ term["commonConfusion"].str;
        if ("relatedLinks" in term && term["relatedLinks"].type == JSONType.array)
        {
            body ~= "\n\nRelated projects:\n";
            foreach (link; term["relatedLinks"].array)
            {
                body ~= "- " ~ link["label"].str ~ " — " ~ link["url"].str;
                if ("blurb" in link)
                    body ~= "\n  " ~ link["blurb"].str;
                body ~= "\n";
            }
        }
        detail.getBuffer().setText(body);

        foreach (c; controlsBox.getChildren())
            controlsBox.remove(c);
        params = null;

        foreach (p; term["parameters"].array)
        {
            if (p["kind"].str != "float" && p["kind"].str != "int")
                continue;
            auto pid = p["id"].str;
            double dval = p["default"].type == JSONType.float_ ? p["default"].floating
                : cast(double) p["default"].integer;
            params[pid] = dval;
            auto row = new Box(Orientation.HORIZONTAL, 6);
            row.packStart(new Label(p["label"].str), false, false, 0);
            double minv = p["min"].type == JSONType.float_ ? p["min"].floating : p["min"].integer;
            double maxv = p["max"].type == JSONType.float_ ? p["max"].floating : p["max"].integer;
            double step = ("step" in p) ? (p["step"].type == JSONType.float_ ? p["step"].floating : 0.1) : 0.1;
            auto scale = new Scale(Orientation.HORIZONTAL, minv, maxv, step);
            scale.setValue(dval);
            scale.setHexpand(true);
            auto captured = pid.dup;
            scale.addOnValueChanged(delegate void(Range r) {
                params[captured] = r.getValue();
                refreshExport();
            });
            row.packStart(scale, true, true, 0);
            controlsBox.packStart(row, false, false, 0);
        }
        controlsBox.showAll();
        refreshExport();
    }

    void refreshExport()
    {
        auto term = lex["terms"][selectedId];
        string apo;
        string obs;
        if ("exports" in term)
        {
            auto ex = term["exports"];
            if ("equalizerApo" in ex)
            {
                apo = ex["equalizerApo"].str;
                foreach (k, v; params)
                    apo = apo.replace("{" ~ k ~ "}", to!string(v));
            }
            if ("obs" in ex)
                obs = ex["obs"].toPrettyString;
        }
        if (!apo.length && !obs.length)
            exportView.getBuffer().setText("Conceptual only — no EqualizerAPO / OBS map.");
        else
            exportView.getBuffer().setText(
                (apo.length ? "# EqualizerAPO\n" ~ apo ~ "\n\n" : "") ~
                (obs.length ? "# OBS\n" ~ obs : ""));
    }
}

void main(string[] args)
{
    Main.init(args);
    new LexiconApp();
    Main.run();
}

import std.conv : to;
import gtk.EditableIF;
import gobject.Value;
import glib.types : GType;
