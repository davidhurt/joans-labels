# Joan's Labels & Letters

A simple web app for printing Avery labels, envelopes and letters at home. No sign-in, no server: everything is saved inside her web browser on her Mac (with a backup button in **My Info**).

## Run it on this Mac

```bash
cd "/Users/davidsmini/Claude Code/Joans Labels and Docs" && python3 -m http.server 8765
```

Then open http://localhost:8765 in Safari and in Chrome.

## Test before publishing (needs a real printer)

1. **Labels:** Labels → type `5160` → pick a few people → **Test print on plain paper**. Hold the page behind a 5160 sheet against a window — boxes should line up. Then try **Print labels** on a real sheet.
2. **Safari:** after clicking Print, the page opens in a new tab → ⌘P → check **Scale 100%**.
3. **Chrome:** the print window should pop up by itself → More settings → **Scale: Actual size**.
4. **Envelopes:** print one #10 envelope. In the print window, pick **Paper Size: Envelope #10**. Note which way her printer wants envelopes fed.
5. **Letters:** write a thank-you note → Print. In Safari make sure "Print headers and footers" is unchecked.
6. **Install:** in Safari, File → **Add to Dock**.

If labels are slightly off on her printer: My Info & Printer Setup → move left/right/up/down. It's remembered.

## Files

- `index.html`, `css/app.css` — page and styles
- `js/templates.js` — Avery template sizes (add new ones here) and envelope sizes
- `js/engine.js` — layout + PDF making (labels and envelopes print as exact-size PDFs)
- `js/views/*` — each screen
- `vendor/jspdf.umd.min.js` — PDF library (jsPDF 2.5.1)
- `sw.js` — lets it open offline; bump `CACHE` when publishing updates

## Automated tests

```bash
npm test
```

Checks every Avery template's geometry, text fitting, sheet planning (used labels, extra sheets), PDF output for every template, font and envelope size, and address-book imports (Mac Contacts vCard, Excel/Numbers CSV).
