(function (root) {
  'use strict';

  const ThemePresets = {
    cyberpunk: {
      themeName: "Cyberpunk Neon",
      "color-primary": "#a855f7",
      "color-secondary": "#7e22ce",
      "color-accent": "#f43f5e",
      "bg-main": "radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.16) 0%, rgba(8, 8, 12, 0.98) 100%)",
      "bg-card": "rgba(255, 255, 255, 0.02)",
      "bg-card-hover": "rgba(255, 255, 255, 0.05)",
      "bg-input": "rgba(0, 0, 0, 0.4)",
      "bg-input-focus": "rgba(168, 85, 247, 0.05)",
      "border-glass": "rgba(255, 255, 255, 0.05)",
      "border-glass-hover": "rgba(255, 255, 255, 0.12)",
      "border-focus": "rgba(168, 85, 247, 0.4)",
      "text-primary": "#F8FAFC",
      "text-secondary": "#d8b4fe",
      "text-muted": "#a78bfa",
      "text-logo-grad": "linear-gradient(135deg, #ffffff 30%, #f43f5e 100%)",
      logo: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#cyberGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <defs>
            <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#a855f7"/>
              <stop offset="100%" stop-color="#f43f5e"/>
            </linearGradient>
          </defs>
          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/>
          <polyline points="7 11 12 16 17 11"/>
          <line x1="12" x2="12" y1="16" y2="7"/>
        </svg>
      `).trim()}`
    },
    sakura: {
      themeName: "Sakura Blossom",
      "color-primary": "#ec4899",
      "color-secondary": "#db2777",
      "color-accent": "#f43f5e",
      "bg-main": "radial-gradient(circle at 50% 0%, rgba(236, 72, 153, 0.12) 0%, rgba(10, 8, 10, 0.98) 100%)",
      "bg-card": "rgba(255, 255, 255, 0.02)",
      "bg-card-hover": "rgba(255, 255, 255, 0.05)",
      "bg-input": "rgba(0, 0, 0, 0.35)",
      "bg-input-focus": "rgba(236, 72, 153, 0.05)",
      "border-glass": "rgba(255, 255, 255, 0.04)",
      "border-glass-hover": "rgba(255, 255, 255, 0.1)",
      "border-focus": "rgba(236, 72, 153, 0.4)",
      "text-primary": "#FFF5F7",
      "text-secondary": "#fbcfe8",
      "text-muted": "#f472b6",
      "text-logo-grad": "linear-gradient(135deg, #ffffff 30%, #f43f5e 100%)",
      logo: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#sakuraGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <defs>
            <linearGradient id="sakuraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ec4899"/>
              <stop offset="100%" stop-color="#f43f5e"/>
            </linearGradient>
          </defs>
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          <path d="M12 9.5V17"/>
          <polyline points="9 14.5 12 17.5 15 14.5"/>
        </svg>
      `).trim()}`
    },
    matrix: {
      themeName: "Hacker Matrix",
      "color-primary": "#10b981",
      "color-secondary": "#059669",
      "color-accent": "#34d399",
      "bg-main": "radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.12) 0%, rgba(5, 8, 6, 0.99) 100%)",
      "bg-card": "rgba(0, 0, 0, 0.2)",
      "bg-card-hover": "rgba(16, 185, 129, 0.05)",
      "bg-input": "rgba(0, 0, 0, 0.5)",
      "bg-input-focus": "rgba(16, 185, 129, 0.05)",
      "border-glass": "rgba(16, 185, 129, 0.1)",
      "border-glass-hover": "rgba(16, 185, 129, 0.25)",
      "border-focus": "rgba(16, 185, 129, 0.5)",
      "text-primary": "#ECFDF5",
      "text-secondary": "#a7f3d0",
      "text-muted": "#6ee7b7",
      "text-logo-grad": "linear-gradient(135deg, #ffffff 30%, #34d399 100%)",
      logo: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#matrixGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <defs>
            <linearGradient id="matrixGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#10b981"/>
              <stop offset="100%" stop-color="#34d399"/>
            </linearGradient>
          </defs>
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="2" y1="20" x2="22" y2="20"/>
          <line x1="12" y1="17" x2="12" y2="20"/>
          <polyline points="9 11 12 14 15 11"/>
          <line x1="12" x2="12" y1="7" y2="14"/>
        </svg>
      `).trim()}`
    },
    ocean: {
      themeName: "Ocean Breeze",
      "color-primary": "#0ea5e9",
      "color-secondary": "#0284c7",
      "color-accent": "#22d3ee",
      "bg-main": "radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.15) 0%, rgba(4, 8, 12, 0.98) 100%)",
      "bg-card": "rgba(255, 255, 255, 0.02)",
      "bg-card-hover": "rgba(255, 255, 255, 0.05)",
      "bg-input": "rgba(0, 0, 0, 0.4)",
      "bg-input-focus": "rgba(14, 165, 233, 0.05)",
      "border-glass": "rgba(255, 255, 255, 0.05)",
      "border-glass-hover": "rgba(255, 255, 255, 0.12)",
      "border-focus": "rgba(14, 165, 233, 0.4)",
      "text-primary": "#F0F9FF",
      "text-secondary": "#bae6fd",
      "text-muted": "#7dd3fc",
      "text-logo-grad": "linear-gradient(135deg, #ffffff 30%, #22d3ee 100%)",
      logo: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#oceanGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <defs>
            <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0ea5e9"/>
              <stop offset="100%" stop-color="#22d3ee"/>
            </linearGradient>
          </defs>
          <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/>
          <polyline points="8 12 12 16 16 12"/>
          <line x1="12" x2="12" y1="8" y2="16"/>
        </svg>
      `).trim()}`
    },
    sunset: {
      themeName: "Sunset Glow",
      "color-primary": "#f97316",
      "color-secondary": "#ea580c",
      "color-accent": "#eab308",
      "bg-main": "radial-gradient(circle at 50% 0%, rgba(249, 115, 22, 0.16) 0%, rgba(10, 6, 4, 0.99) 100%)",
      "bg-card": "rgba(255, 255, 255, 0.02)",
      "bg-card-hover": "rgba(255, 255, 255, 0.05)",
      "bg-input": "rgba(0, 0, 0, 0.4)",
      "bg-input-focus": "rgba(249, 115, 22, 0.05)",
      "border-glass": "rgba(255, 255, 255, 0.05)",
      "border-glass-hover": "rgba(255, 255, 255, 0.12)",
      "border-focus": "rgba(249, 115, 22, 0.4)",
      "text-primary": "#FFF7ED",
      "text-secondary": "#fed7aa",
      "text-muted": "#fdba74",
      "text-logo-grad": "linear-gradient(135deg, #ffffff 30%, #eab308 100%)",
      logo: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#sunsetGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <defs>
            <linearGradient id="sunsetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f97316"/>
              <stop offset="100%" stop-color="#eab308"/>
            </linearGradient>
          </defs>
          <path d="M17 18a5 5 0 0 0-10 0"/>
          <line x1="12" y1="2" x2="12" y2="9"/>
          <polyline points="8 6 12 10 16 6"/>
          <line x1="2" y1="22" x2="22" y2="22"/>
        </svg>
      `).trim()}`
    }
  };

  class ThemeManager {
    constructor() {
      this.themeFileInput = null;
      this.btnUploadTheme = null;
      this.btnExportTheme = null;
      this.btnResetTheme = null;
      this.themeTextInput = null;
      this.btnImportThemeText = null;
      this.btnCopyThemePrompt = null;
      
      this.themeTargetPanel = null;
      this.btnApplyTargetManga = null;
      this.btnApplyTargetHentai = null;
      this.btnApplyTargetBoth = null;
      
      this.pendingTheme = null;
    }

    init(popupInstance) {
      this.popup = popupInstance;
      
      this.btnUploadTheme = document.getElementById('btn-upload-theme');
      this.btnExportTheme = document.getElementById('btn-export-theme');
      this.btnResetTheme = document.getElementById('btn-reset-theme');
      this.themeFileInput = document.getElementById('theme-file-input');
      this.themeTextInput = document.getElementById('theme-text-input');
      this.btnImportThemeText = document.getElementById('btn-import-theme-text');
      this.btnCopyThemePrompt = document.getElementById('btn-copy-theme-prompt');
      
      this.themeTargetPanel = document.getElementById('theme-target-panel');
      this.btnApplyTargetManga = document.getElementById('btn-apply-target-manga');
      this.btnApplyTargetHentai = document.getElementById('btn-apply-target-hentai');
      this.btnApplyTargetBoth = document.getElementById('btn-apply-target-both');

      if (this.btnUploadTheme && this.themeFileInput) {
        this.btnUploadTheme.addEventListener('click', () => this.themeFileInput.click());
        this.themeFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
      }

      if (this.btnExportTheme) {
        this.btnExportTheme.addEventListener('click', () => this.exportTheme());
      }

      if (this.btnResetTheme) {
        this.btnResetTheme.addEventListener('click', () => this.resetTheme());
      }

      if (this.btnImportThemeText) {
        this.btnImportThemeText.addEventListener('click', () => this.importThemeFromText());
      }

      if (this.btnCopyThemePrompt) {
        this.btnCopyThemePrompt.addEventListener('click', () => this.copyThemePrompt());
      }

      if (this.btnApplyTargetManga) {
        this.btnApplyTargetManga.addEventListener('click', () => this.savePendingThemeTo('manga'));
      }

      if (this.btnApplyTargetHentai) {
        this.btnApplyTargetHentai.addEventListener('click', () => this.savePendingThemeTo('hentai'));
      }

      if (this.btnApplyTargetBoth) {
        this.btnApplyTargetBoth.addEventListener('click', () => this.savePendingThemeTo('both'));
      }

      // Add preset click listeners
      const presetBtns = document.querySelectorAll('.theme-preset-btn');
      presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const presetKey = btn.getAttribute('data-preset');
          this.applyPreset(presetKey);
        });
      });
    }

    applyPreset(key) {
      const theme = ThemePresets[key];
      if (!theme) return;
      this.pendingTheme = theme;
      this.showTargetPanel(true);
      this.popup.showNotification(`Đã chọn giao diện mẫu "${theme.themeName}"! Hãy chọn chế độ áp dụng bên dưới.`, 'success');
    }

    async handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      
      if (file.name.endsWith('.json')) {
        reader.onload = async (e) => {
          try {
            const content = e.target.result;
            const theme = JSON.parse(content);
            if (!theme || typeof theme !== 'object') {
              this.popup.showNotification('File JSON không hợp lệ!', 'error');
              return;
            }
            this.pendingTheme = theme;
            this.showTargetPanel(true);
            this.popup.showNotification('Chọn giao diện muốn áp dụng bên dưới!', 'info');
          } catch (err) {
            console.error('Theme import failed:', err);
            this.popup.showNotification('Lỗi khi đọc file cấu hình giao diện.', 'error');
          } finally {
            this.themeFileInput.value = '';
          }
        };
        reader.readAsText(file);
      } else if (file.type.startsWith('image/')) {
        reader.onload = async (e) => {
          try {
            const dataUrl = e.target.result;
            this.autoGenerateThemeFromLogo(dataUrl);
          } catch (err) {
            console.error('Image loading failed:', err);
            this.popup.showNotification('Lỗi khi đọc file ảnh logo.', 'error');
          } finally {
            this.themeFileInput.value = '';
          }
        };
        reader.readAsDataURL(file);
      } else {
        this.popup.showNotification('Định dạng file không được hỗ trợ! Hãy chọn ảnh (.png, .jpg...) hoặc file cấu hình (.json).', 'error');
        this.themeFileInput.value = '';
      }
    }

    autoGenerateThemeFromLogo(base64Image) {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 1, 1);
          const pixel = ctx.getImageData(0, 0, 1, 1).data;
          
          const r = pixel[0];
          const g = pixel[1];
          const b = pixel[2];
          
          const hsl = this.rgbToHsl(r, g, b);
          const h = hsl[0];
          const s = Math.max(40, Math.min(hsl[1], 90)); // Cap saturation between 40% and 90%
          
          // Generate primary, secondary and matching gradient background
          const primary = `hsl(${h}, ${s}%, 60%)`;
          const secondary = `hsl(${h}, ${s}%, 45%)`;
          const bgMain = `radial-gradient(circle at 50% 0%, hsla(${h}, ${s}%, 50%, 0.12) 0%, rgba(8, 8, 12, 0.98) 100%)`;
          const bgHeader = `rgba(8, 8, 12, 0.65)`;
          const textLogoGrad = `linear-gradient(135deg, #ffffff 30%, hsl(${h}, ${s}%, 85%) 100%)`;
          
          const theme = {
            themeName: `Auto_Generated`,
            logo: base64Image,
            "color-primary": primary,
            "color-secondary": secondary,
            "bg-main": bgMain,
            "bg-header": bgHeader,
            "text-logo-grad": textLogoGrad
          };
          
          this.pendingTheme = theme;
          this.showTargetPanel(true);
          this.popup.showNotification('Màu sắc tự động đồng bộ đã được tạo! Hãy chọn giao diện áp dụng bên dưới.', 'info');
        } catch (err) {
          console.error('Failed to extract average color:', err);
          this.popup.showNotification('Không thể phân tích màu sắc của ảnh. Sử dụng logo gốc.', 'warning');
          
          const theme = {
            themeName: "Custom Logo Only",
            logo: base64Image
          };
          this.pendingTheme = theme;
          this.showTargetPanel(true);
        }
      };
      
      img.onerror = () => {
        this.popup.showNotification('Không thể đọc file ảnh logo.', 'error');
      };
      
      img.src = base64Image;
    }

    rgbToHsl(r, g, b) {
      r /= 255, g /= 255, b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0; // achromatic
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    }

    getContrastColor(colorStr) {
      if (!colorStr) return '#ffffff';
      colorStr = colorStr.trim().toLowerCase();

      // Case 1: HSL/HSLA
      if (colorStr.startsWith('hsl')) {
        // Extract the Lightness component (the 3rd percentage number, e.g. hsl(120, 50%, 70%) -> 70)
        const matches = colorStr.match(/hsl[a]?\(\s*\d+\s*,\s*\d+%\s*,\s*(\d+)%\s*(?:,|\))/);
        if (matches && matches[1]) {
          const lightness = parseInt(matches[1], 10);
          return lightness > 65 ? '#0f172a' : '#ffffff';
        }
      }

      // Case 2: HEX
      if (colorStr.startsWith('#')) {
        let hex = colorStr.substring(1);
        if (hex.length === 3) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          // Calculate relative luminance
          const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          return luminance > 0.55 ? '#0f172a' : '#ffffff';
        }
      }

      // Case 3: RGB/RGBA
      if (colorStr.startsWith('rgb')) {
        const matches = colorStr.match(/rgb[a]?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*/);
        if (matches) {
          const r = parseInt(matches[1], 10);
          const g = parseInt(matches[2], 10);
          const b = parseInt(matches[3], 10);
          const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          return luminance > 0.55 ? '#0f172a' : '#ffffff';
        }
      }

      // Fallback
      return '#ffffff';
    }

    async applyCustomTheme() {
      try {
        const isNsfw = document.body.classList.contains('nsfw-mode-active');
        const key = isNsfw ? 'customThemeHentai' : 'customThemeManga';
        const data = await chrome.storage.local.get([key, 'customTheme']);
        
        let theme = data[key];
        if (!theme) {
          // Fallback to legacy theme key
          theme = data.customTheme;
        }

        const rootEl = document.documentElement;
        
        if (!theme) {
          // Reset custom styles (remove inline properties)
          this.removeInlineStyles();
          return;
        }

        const variables = [
          'color-primary', 'color-secondary', 'color-accent', 
          'color-success', 'color-danger', 'color-warning',
          'bg-main', 'bg-card', 'bg-card-hover', 'bg-input', 
          'bg-input-focus', 'bg-tabs', 'bg-footer', 'bg-header',
          'border-glass', 'border-glass-hover', 'border-focus',
          'text-primary', 'text-secondary', 'text-muted',
          'text-logo-grad'
        ];

        variables.forEach(v => {
          if (theme[v]) {
            rootEl.style.setProperty(`--${v}`, theme[v]);
          } else {
            rootEl.style.removeProperty(`--${v}`);
          }
        });

        // Compute contrast text colors for primary and secondary if custom theme variables exist
        if (theme['color-primary']) {
          rootEl.style.setProperty('--text-on-primary', this.getContrastColor(theme['color-primary']));
        } else {
          rootEl.style.removeProperty('--text-on-primary');
        }
        if (theme['color-secondary']) {
          rootEl.style.setProperty('--text-on-secondary', this.getContrastColor(theme['color-secondary']));
        } else {
          rootEl.style.removeProperty('--text-on-secondary');
        }

        // Apply custom logo image safely (strictly check protocols to comply with MV3 security guidelines)
        const logoImg = document.querySelector('.app-logo-img');
        if (logoImg) {
          let logoSrc = isNsfw ? '../icons/hentai_icon48.png' : '../icons/icon48.png';
          if (theme.logo && (theme.logo.startsWith('data:image/') || theme.logo.startsWith('blob:') || theme.logo.startsWith('../icons/'))) {
            logoSrc = theme.logo;
          }
          logoImg.src = logoSrc;
        }
      } catch (err) {
        console.error('Failed to apply custom theme:', err);
      }
    }

    removeInlineStyles() {
      const rootEl = document.documentElement;
      const variables = [
        'color-primary', 'color-secondary', 'color-accent', 
        'color-success', 'color-danger', 'color-warning',
        'bg-main', 'bg-card', 'bg-card-hover', 'bg-input', 
        'bg-input-focus', 'bg-tabs', 'bg-footer', 'bg-header',
        'border-glass', 'border-glass-hover', 'border-focus',
        'text-primary', 'text-secondary', 'text-muted',
        'text-logo-grad'
      ];
      variables.forEach(v => {
        rootEl.style.removeProperty(`--${v}`);
      });
      rootEl.style.removeProperty('--text-on-primary');
      rootEl.style.removeProperty('--text-on-secondary');
      
      const logoImg = document.querySelector('.app-logo-img');
      if (logoImg) {
        const isNsfw = document.body.classList.contains('nsfw-mode-active');
        logoImg.src = isNsfw ? '../icons/hentai_icon48.png' : '../icons/icon48.png';
      }
    }

    async exportTheme() {
      try {
        const isNsfw = document.body.classList.contains('nsfw-mode-active');
        const key = isNsfw ? 'customThemeHentai' : 'customThemeManga';
        const data = await chrome.storage.local.get([key, 'customTheme']);
        
        let theme = data[key];
        if (!theme) {
          theme = data.customTheme;
        }

        if (!theme) {
          const modeName = isNsfw ? 'Hentai' : 'Manga';
          this.popup.showNotification(`Bạn chưa tùy biến giao diện ${modeName} nào để xuất!`, 'warning');
          return;
        }

        const jsonString = JSON.stringify(theme, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const modeSuffix = isNsfw ? 'hentai' : 'manga';
        a.download = `manga-downloader-theme-${modeSuffix}-${theme.themeName || 'custom'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.popup.showNotification('Đã xuất giao diện thành công!', 'success');
      } catch (err) {
        console.error('Export theme failed:', err);
        this.popup.showNotification('Lỗi khi xuất giao diện.', 'error');
      }
    }

    async resetTheme() {
      const isNsfw = document.body.classList.contains('nsfw-mode-active');
      const modeName = isNsfw ? 'Hentai' : 'Manga';
      if (!confirm(`Bạn có chắc chắn muốn đặt lại giao diện mặc định cho ${modeName}?`)) return;
      try {
        const key = isNsfw ? 'customThemeHentai' : 'customThemeManga';
        await chrome.storage.local.remove([key, 'customTheme']);
        await this.applyCustomTheme();
        this.popup.showNotification(`Đã khôi phục giao diện mặc định cho ${modeName}.`, 'success');
      } catch (err) {
        console.error('Reset theme failed:', err);
      }
    }

    async importThemeFromText() {
      if (!this.themeTextInput) return;
      const rawInput = this.themeTextInput.value.trim();
      if (!rawInput) {
        this.popup.showNotification('Vui lòng nhập hoặc dán mã cấu hình giao diện!', 'warning');
        return;
      }

      // Friendly extraction: if the user pastes forum posts with text like "Here is my theme: { ... } enjoy!",
      // we locate the first occurrence of '{' and the last occurrence of '}' to extract the JSON payload.
      const firstBrace = rawInput.indexOf('{');
      const lastBrace = rawInput.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        this.popup.showNotification('Mã giao diện không hợp lệ! Vui lòng đảm bảo mã chứa cặp ngoặc nhọn { ... }.', 'error');
        return;
      }

      const jsonString = rawInput.substring(firstBrace, lastBrace + 1);

      try {
        const theme = JSON.parse(jsonString);
        if (!theme || typeof theme !== 'object') {
          this.popup.showNotification('Cấu hình giao diện không hợp lệ!', 'error');
          return;
        }

        this.pendingTheme = theme;
        this.showTargetPanel(true);
        
        // Clear textarea inputs on success
        this.themeTextInput.value = '';
        this.popup.showNotification('Đã nhận mã cấu hình! Chọn giao diện muốn áp dụng bên dưới.', 'info');
      } catch (err) {
        console.error('Text-based theme import failed:', err);
        this.popup.showNotification('Lỗi cú pháp JSON! Không thể phân tích mã cấu hình giao diện.', 'error');
      }
    }

    showTargetPanel(show) {
      if (this.themeTargetPanel) {
        this.themeTargetPanel.style.display = show ? 'flex' : 'none';
        if (show) {
          this.themeTargetPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }

    async savePendingThemeTo(target) {
      if (!this.pendingTheme) {
        this.popup.showNotification('Không có cấu hình giao diện nào đang chờ để áp dụng!', 'warning');
        return;
      }

      try {
        if (target === 'manga') {
          await chrome.storage.local.set({ customThemeManga: this.pendingTheme });
          this.popup.showNotification('Đã áp dụng giao diện thành công cho Manga!', 'success');
        } else if (target === 'hentai') {
          await chrome.storage.local.set({ customThemeHentai: this.pendingTheme });
          this.popup.showNotification('Đã áp dụng giao diện thành công cho Hentai!', 'success');
        } else if (target === 'both') {
          await chrome.storage.local.set({ 
            customThemeManga: this.pendingTheme,
            customThemeHentai: this.pendingTheme
          });
          this.popup.showNotification('Đã áp dụng giao diện thành công cho cả hai chế độ!', 'success');
        }

        // Apply theme immediately
        await this.applyCustomTheme();
        
        // Clear pending state and hide panel
        this.pendingTheme = null;
        this.showTargetPanel(false);
      } catch (err) {
        console.error('Failed to save target theme:', err);
        this.popup.showNotification('Lỗi khi lưu cấu hình giao diện.', 'error');
      }
    }

    async copyThemePrompt() {
      // Find reference theme (pending first, then currently active theme in storage)
      let activeTheme = this.pendingTheme;
      if (!activeTheme) {
        const isNsfw = document.body.classList.contains('nsfw-mode-active');
        const key = isNsfw ? 'customThemeHentai' : 'customThemeManga';
        const data = await chrome.storage.local.get([key, 'customTheme']);
        activeTheme = data[key] || data.customTheme;
      }

      let referenceSection = '';
      let styleRequirement = `[Vui lòng xóa dòng này và thay thế bằng mô tả của bạn. Ví dụ: "Tông màu Neon xanh ngọc và tím đậm kiểu tương lai hoang dã", "Màu sắc quả đào hồng dịu mắt nữ tính", "Giao diện tối huyền bí tông màu xanh lá ma trận Hacker"...]`;

      if (activeTheme) {
        referenceSection = `
GIAO DIỆN THAM CHIẾU HIỆN TẠI:
- Tên: ${activeTheme.themeName || 'Giao diện đang áp dụng'}
- Màu nhấn chính color-primary: ${activeTheme['color-primary'] || ''}
- Màu nhấn phụ color-secondary: ${activeTheme['color-secondary'] || ''}
- Màu nhấn nổi bật color-accent: ${activeTheme['color-accent'] || ''}
- Nền chính bg-main: ${activeTheme['bg-main'] || ''}
- Nền thẻ bg-card: ${activeTheme['bg-card'] || ''}
- Chữ logo text-logo-grad: ${activeTheme['text-logo-grad'] || ''}
`;
        styleRequirement = `Hãy tạo một giao diện tùy biến được cải tiến, sửa đổi hoặc biến thể dựa trên phong cách của [${activeTheme.themeName || 'Giao diện hiện tại'}] ở trên. [Bạn hãy mô tả các chi tiết cần thay đổi vào đây, ví dụ: "tăng độ tối của nền lên", "thay màu nhấn primary thành màu neon lục bảo"...]`;
      }

      const promptText = `Bạn là một trợ lý thiết kế giao diện chuyên nghiệp. Hãy tạo một cấu hình JSON tùy biến giao diện cho tiện ích mở rộng Manga Downloader theo phong cách yêu cầu bên dưới.
${referenceSection}
Yêu cầu định dạng tệp cấu hình JSON phải chính xác như mẫu sau:
{
  "themeName": "Tên Giao Diện (ví dụ: Cyberpunk Neon)",
  "color-primary": "Màu nhấn chủ đạo (HEX hoặc HSL, ví dụ: #a855f7)",
  "color-secondary": "Màu nhấn phụ (HEX hoặc HSL, ví dụ: #7e22ce)",
  "color-accent": "Màu nhấn nổi bật (ví dụ: #ec4899)",
  "bg-main": "Màu nền chính hoặc dải màu gradient (ví dụ: radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.15) 0%, rgba(10, 10, 15, 0.98) 100%))",
  "bg-card": "Màu nền các khung/thẻ (ví dụ: rgba(255, 255, 255, 0.03))",
  "bg-card-hover": "Màu nền các khung khi hover (ví dụ: rgba(255, 255, 255, 0.06))",
  "bg-input": "Màu nền các ô nhập dữ liệu (ví dụ: rgba(0, 0, 0, 0.4))",
  "bg-input-focus": "Màu nền ô nhập khi chọn (ví dụ: rgba(168, 85, 247, 0.05))",
  "border-glass": "Đường viền kính bán trong suốt (ví dụ: rgba(255, 255, 255, 0.05))",
  "border-glass-hover": "Đường viền kính khi di chuột (ví dụ: rgba(255, 255, 255, 0.1))",
  "border-focus": "Đường viền khi focus ô nhập (ví dụ: rgba(168, 85, 247, 0.4))",
  "text-primary": "Màu chữ chính (ví dụ: #ffffff)",
  "text-secondary": "Màu chữ phụ (ví dụ: #9ca3af)",
  "text-muted": "Màu chữ mờ (ví dụ: #6b7280)",
  "text-logo-grad": "Hiệu ứng chữ logo gradient (ví dụ: linear-gradient(135deg, #ffffff 30%, #d8b4fe 100%))"
}

Yêu cầu thiết kế:
1. Đảm bảo độ tương phản chữ tốt, dễ đọc trên nền đã thiết lập.
2. Tạo cảm giác cao cấp (Premium), hiện đại và có chiều sâu bằng cách dùng gradient cho bg-main và text-logo-grad.
3. Chỉ trả về một khối JSON hợp lệ chứa các thuộc tính trên (không bao gồm lời giải thích hoặc các từ chào hỏi).

PHONG CÁCH GIAO DIỆN YÊU CẦU:
${styleRequirement}`;

      try {
        await navigator.clipboard.writeText(promptText);
        this.popup.showNotification('Đã sao chép Prompt AI vào khay nhớ tạm!', 'success');
      } catch (err) {
        console.error('Failed to copy prompt:', err);
        // Fallback for copy using temporary textarea
        try {
          const tempTextArea = document.createElement('textarea');
          tempTextArea.value = promptText;
          document.body.appendChild(tempTextArea);
          tempTextArea.select();
          document.execCommand('copy');
          document.body.removeChild(tempTextArea);
          this.popup.showNotification('Đã sao chép Prompt AI vào khay nhớ tạm (fallback)!', 'success');
        } catch (fallbackErr) {
          this.popup.showNotification('Không thể sao chép tự động. Hãy chụp/sao chép thủ công.', 'error');
        }
      }
    }
  }

  root.ThemeManager = new ThemeManager();
})(typeof globalThis !== 'undefined' ? globalThis : this);
