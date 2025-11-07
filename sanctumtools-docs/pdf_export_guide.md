# PDF Export Guide

## Purpose
This guide explains how to export your mood tracking files to PDF format for sharing with healthcare providers, therapists, or for your own records.

---

## Method 1: Using Pandoc (Linux/Mac/Windows)

### Installation

**Linux (Fedora/RHEL):**
```bash
sudo dnf install pandoc
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install pandoc
```

**Mac:**
```bash
brew install pandoc
```

**Windows:**
Download from https://pandoc.org/installing.html

### Basic Usage

**Convert a single tracker to PDF:**
```bash
pandoc mood_shift_tracker.md -o mood_shift_tracker.pdf
```

**Convert with custom options:**
```bash
pandoc rapid_cycling_tracker.md -o report.pdf \
  --pdf-engine=xelatex \
  -V geometry:margin=1in \
  -V fontsize=11pt
```

### Batch Export Multiple Files

**Create a reports directory:**
```bash
mkdir -p reports
```

**Export all trackers with timestamp:**
```bash
DATE=$(date +%Y-%m-%d)
pandoc rapid_cycling_tracker.md -o reports/rapid_cycling_${DATE}.pdf
pandoc episode_tracker.md -o reports/episodes_${DATE}.pdf
pandoc mood_shift_template.md -o reports/mood_shifts_${DATE}.pdf
```

---

## Method 2: Using Markdown Preview (Simple)

Most markdown editors have built-in PDF export:

**VS Code:**
1. Install "Markdown PDF" extension
2. Open your tracker file
3. Right-click → "Markdown PDF: Export (pdf)"

**Typora:**
1. File → Export → PDF
2. Choose save location

**Mark Text:**
1. File → Export
2. Select PDF format

---

## Method 3: Print to PDF (Any Platform)

**In any application with print capability:**
1. Open the markdown file in a viewer/editor
2. File → Print (or Ctrl+P / Cmd+P)
3. Select "Save as PDF" or "Microsoft Print to PDF"
4. Choose save location

---

## Recommended Workflow

### For Regular Tracking Sessions

Create a simple script to export all trackers at once:

**export_trackers.sh:**
```bash
#!/bin/bash

# Set output directory
REPORTS_DIR="reports"
DATE=$(date +%Y-%m-%d_%H-%M)

# Create reports directory if it doesn't exist
mkdir -p "$REPORTS_DIR"

# Export each tracker
echo "Exporting trackers to PDF..."

pandoc rapid_cycling_tracker.md -o "$REPORTS_DIR/rapid_cycling_${DATE}.pdf" 2>/dev/null && \
  echo "✓ Rapid cycling tracker exported"

pandoc episode_tracker.md -o "$REPORTS_DIR/episodes_${DATE}.pdf" 2>/dev/null && \
  echo "✓ Episode tracker exported"

pandoc mood_shift_template.md -o "$REPORTS_DIR/mood_shifts_${DATE}.pdf" 2>/dev/null && \
  echo "✓ Mood shift template exported"

echo "Done! PDFs saved to $REPORTS_DIR/"
```

**Make it executable:**
```bash
chmod +x export_trackers.sh
```

**Run it:**
```bash
./export_trackers.sh
```

---

## For Healthcare Appointments

**Before psychiatrist/therapist appointments:**

1. Export your trackers to PDF with date in filename
2. Review the PDF to ensure it's readable
3. Email to provider or bring printed copy
4. Keep copies organized by date for historical reference

**Example naming convention:**
```
reports/
  ├── rapid_cycling_2025-10-15.pdf
  ├── rapid_cycling_2025-10-22.pdf
  ├── episodes_2025-10-15.pdf
  └── mood_shifts_2025-10-15.pdf
```

---

## Troubleshooting

**"pandoc: command not found"**
- Pandoc is not installed. Follow installation instructions above.

**"pdflatex not found"**
- Install LaTeX distribution:
  - Linux: `sudo dnf install texlive-scheme-basic` or `sudo apt install texlive`
  - Mac: Install MacTeX from https://www.tug.org/mactex/
  - Windows: Install MiKTeX from https://miktex.org/

**PDF looks ugly or poorly formatted**
- Try adding formatting options:
  ```bash
  pandoc input.md -o output.pdf -V geometry:margin=1in -V fontsize=12pt
  ```

**Special characters not displaying**
- Use XeLaTeX engine:
  ```bash
  pandoc input.md -o output.pdf --pdf-engine=xelatex
  ```

---

## Privacy Note

When exporting PDFs for sharing:
- Review the content to ensure no unwanted personal information is included
- Consider creating sanitized versions for general healthcare providers
- Keep detailed versions for your primary psychiatrist/therapist only
- Store PDFs securely (encrypted folder, password-protected if sharing via email)

---

## Automation Ideas

**Automatic daily exports:**

Create a cron job (Linux/Mac) to export trackers daily:

```bash
# Edit crontab
crontab -e

# Add line to export at 11:59 PM daily
59 23 * * * cd /path/to/SanctumTools && ./export_trackers.sh
```

**Automatic weekly summaries:**

Export on Sundays at 8 PM for Monday therapy appointments:

```bash
0 20 * * 0 cd /path/to/SanctumTools && ./export_trackers.sh
```

---

## Alternative Tools

If pandoc doesn't work for your system:

- **wkhtmltopdf**: Converts HTML/markdown to PDF
- **grip**: GitHub-flavored markdown renderer with export
- **markdown-pdf** (npm): Node.js-based converter
- Online converters: CloudConvert, Markdown to PDF websites (use with caution for sensitive data)

---

## Questions or Issues?

If you run into problems with PDF export:
1. Check that pandoc is installed: `pandoc --version`
2. Test with a simple markdown file first
3. Try different PDF engines if default doesn't work
4. Consider using print-to-PDF as a fallback method
