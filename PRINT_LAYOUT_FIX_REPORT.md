# Worksheet A4 print layout

Reviewed on 2026-11-03 against baseline `65e6892c9cc5480d788460b1db2fff1a2b70b409`.

## Why short worksheets spilled

The screen preview uses a 210 × 297 mm sheet with 10 mm internal padding and a shadow. The print iframe already supplied 10 mm page margins, which leave 190 × 277 mm for content. Its stylesheet changed the wrapper width and display mode but left the inline 297 mm minimum height, padding and shadow in place. The cloned wrapper therefore exceeded the usable height and gave the document a second inset. Both baseline short PDFs had two pages. The three-part baseline visibly carried the bottom of the handover border onto a textless second page.

The description also printed as a textarea. Chromium printed the visible portion of the control, so later lines in the long fixture were missing from the baseline PDF.

## Corrections

- The isolated iframe stylesheet declares A4 portrait and 10 mm margins. The wrapper uses the page's available width with border-box sizing and normal document flow. Print overrides remove its preview minimum height, padding and shadow. No scale transform is used.
- The description keeps its 200 px minimum section height and 14 px type. The iframe hides the textarea and shows a text block from the same current React value. Preserved line breaks and wrapping let long descriptions continue across pages. The screen preview still renders the editable yellow textarea.
- Print inputs and selects retain their live values and use transparent backgrounds on white paper. Print rules suppress native borders, outlines, placeholder ink and the caret.
- Both signature blocks use `break-inside: avoid`. The three totals rows form a separate protected row group. The parts table can span pages, with intact rows and repeated column headers. The existing calculation functions still supply the printed amounts.

The worksheet's headings, fields, legal text, table structure, font family, section order and signature boxes are preserved. The rendered content is wider because the page inset is applied once, which also changes some line wrapping. The preview keeps its existing A4 panel, scroll area, editable yellow fields and print/close controls. The stylesheet is still loaded only through the worksheet print iframe.

## Printing from the browser

In the browser print dialog, select **A4**, **Portrait**, **100%** scale and the default margins so the browser can use the stylesheet's 10 mm margins. If the browser or printer overrides those margins, select custom margins of **10 mm on each side** where supported and check the preview before printing. Turn off **Headers and footers** in the browser's print options, usually under **More settings**.

The browser controls its timestamp, page title, URL and page-number decorations. The application supplies the document title and page CSS. The Chromium tests explicitly set `displayHeaderFooter: false` and check the output for browser URLs. Visual inspection also confirmed clean margins in the test PDFs. A physical printer and its driver were outside this validation.

## Actual Chromium PDFs

| Disposable fixture | Before | After | PDF evidence |
| --- | ---: | ---: | --- |
| One part plus labor | 2 | **1** | Complete signatures and total of 773 Ft |
| Three parts plus labor | 2 | **1** | Complete handover border and total of 1,321 Ft |
| 80 edited description lines, three parts plus labor | 2 | **3** | All 80 lines present, then signatures, parts and totals |
| 75 parts plus labor | 3 | **3** | All 75 rows present, repeated headings, total of 21,049 Ft and complete handover section |

The test clicks the application's Print button and captures the actual react-to-print document when its print method runs. It serializes the iframe's live control values and renders that document in a top-level Chromium page with CSS page size, background printing and scale 1. The PDF assertions read actual page dimensions, count and extracted text. They check for blank pages, lost rows or description lines, split signature labels or totals, stale preview values and missing worksheet labels.

I inspected Poppler renderings of all eight corrected pages, the two-page baseline three-part sample and the desktop preview screenshot. The corrected short PDFs have complete bottom borders. Continuation pages carry the description or table rows and the final signature sections remain intact. The before/after synthetic PDFs and renderings are under the ignored `Frontend/review-artifacts/worksheet-pdf/` directory. [Baseline border fragment](C:/CarServiceApp/CarServiceApp/Frontend/review-artifacts/worksheet-pdf/before/three-parts-2.png) · [Corrected three-part sheet](C:/CarServiceApp/CarServiceApp/Frontend/review-artifacts/worksheet-pdf/after/three-parts-1.png)

## Verification

| Check | Result |
| --- | --- |
| Frontend `npm ci` | Passed with existing npm advisory and tooling notices |
| Strict TypeScript | Passed as part of the production build |
| Frontend production build | Passed |
| Focused Chromium PDF suite | 4 passed |
| Complete Chromium suite | 94 passed in 3.9 minutes, including the four PDF cases |
| `git diff --check` | Passed |

The PDF tests require Python with `pypdf` installed. Set `WORKSHEET_PDF_PYTHON` to the Python executable if it differs from `python` on PATH. From the frontend directory after the production build, run `npm exec -- playwright test worksheet-pdf.spec.ts --project=chromium` for the focused cases. The existing Playwright web servers provision disposable databases and uploads for both focused and full runs.

Changed files are the worksheet print modal, its isolated stylesheet, the new PDF test and this report. The existing local `AuthController.cs` worktree entry was left alone. The local preview servers were stopped to free the regression ports and are stopped at handoff.
