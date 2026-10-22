/**
 * A 1 ENTERPRISES — Physical Invoice / Cash Memo Application
 * Vanilla JavaScript ES6+ (No Frameworks)
 * Handles auto-calculations, Indian number-to-words, 
 * live editable table, auto-extending description rows, 
 * localStorage, and direct device file downloads.
 */

(function () {
  'use strict';

  // ==========================================================================
  // CONFIGURATION & DEFAULT DATA
  // ==========================================================================
  const DEFAULT_COMPANY = {
    name: 'A 1 ENTERPRISES',
    gstin: '27CCYPP0748Q1ZE',
    address: 'OPP-ALLAHU AKBAR BLD, Kondhwa Budruk, Pune, Maharashtra- 411048',
    phone1: '97672 14594',
    phone2: '97646 72936',
    gstPercent: 0
  };

  const MIN_PAD_ROWS = 14; // Default ruled lines matching the physical pad

  // State
  let companyProfile = { ...DEFAULT_COMPANY };
  let itemsData = [
    { desc: '', hsn: '', qty: '', rate: '', amount: 0 }
  ];

  // DOM Elements cache
  const elements = {
    // Top Bar Actions
    btnAddItem: document.getElementById('btn-add-item'),
    btnRemoveItem: document.getElementById('btn-remove-item'),
    btnDownloadPng: document.getElementById('btn-download-png'),
    btnDownloadPdf: document.getElementById('btn-download-pdf'),
    btnSettings: document.getElementById('btn-settings'),
    btnSave: document.getElementById('btn-save'),
    btnLoad: document.getElementById('btn-load'),
    btnSampleData: document.getElementById('btn-sample-data'),
    btnClear: document.getElementById('btn-clear'),
    btnPrint: document.getElementById('btn-print'),
    toast: document.getElementById('toast-message'),

    // Invoice Header Displays
    displayGstin: document.getElementById('display-gstin'),
    displayPhone1: document.getElementById('display-phone1'),
    displayPhone2: document.getElementById('display-phone2'),
    displayCompanyName: document.getElementById('display-company-name'),
    displayCompanyAddress: document.getElementById('display-company-address'),
    displaySignCompany: document.getElementById('display-sign-company'),

    // Invoice Meta Inputs
    invNumber: document.getElementById('inv-number'),
    invDate: document.getElementById('inv-date'),
    invCustName: document.getElementById('inv-cust-name'),
    invCustAddress: document.getElementById('inv-cust-address'),

    // Table & Summary
    tbody: document.getElementById('product-rows-body'),
    grandTotal: document.getElementById('display-grand-total'),
    amountWordsLine1: document.getElementById('display-amount-words'),
    amountWordsLine2: document.getElementById('display-amount-words-continuation'),

    // Settings Modal
    settingsModal: document.getElementById('settings-modal'),
    modalBackdrop: document.getElementById('settings-backdrop'),
    btnCloseModal: document.getElementById('btn-close-settings'),
    formSettings: document.getElementById('settings-form'),
    btnResetSettings: document.getElementById('btn-reset-settings'),
    cfgCompanyName: document.getElementById('cfg-company-name'),
    cfgGstin: document.getElementById('cfg-gstin'),
    cfgAddress: document.getElementById('cfg-address'),
    cfgPhone1: document.getElementById('cfg-phone1'),
    cfgPhone2: document.getElementById('cfg-phone2'),
    cfgGstPercent: document.getElementById('cfg-gst-percent')
  };

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  function init() {
    loadCompanySettings();
    setDefaultDate();
    loadSavedInvoice(false); // quiet auto-load from localStorage if available

    bindEvents();
    renderTable();
    calculateTotal();
    initMobileFeatures();
  }

  // Mobile horizontal scroll helper
  function initMobileFeatures() {
    const scrollWrapper = document.getElementById('paper-scroll-wrapper');
    const swipeGuide = document.querySelector('.mobile-swipe-guide');
    if (scrollWrapper && swipeGuide) {
      scrollWrapper.addEventListener('scroll', () => {
        if (scrollWrapper.scrollLeft > 25) {
          swipeGuide.style.opacity = '0';
          swipeGuide.style.pointerEvents = 'none';
        } else {
          swipeGuide.style.opacity = '1';
          swipeGuide.style.pointerEvents = 'auto';
        }
      }, { passive: true });
    }
  }

  // Set today's date in Indian format DD/MM/YYYY
  function setDefaultDate() {
    if (elements.invDate && !elements.invDate.value) {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      elements.invDate.value = `${dd}/${mm}/${yyyy}`;
    }
  }

  // ==========================================================================
  // EVENT BINDINGS
  // ==========================================================================
  function bindEvents() {
    // Toolbar Actions
    if (elements.btnAddItem) {
      elements.btnAddItem.addEventListener('click', () => addProductRow());
    }

    if (elements.btnRemoveItem) {
      elements.btnRemoveItem.addEventListener('click', () => removeProductRow());
    }

    if (elements.btnDownloadPng) {
      elements.btnDownloadPng.addEventListener('click', downloadPNG);
    }

    if (elements.btnDownloadPdf) {
      elements.btnDownloadPdf.addEventListener('click', downloadPDF);
    }

    if (elements.btnSettings) {
      elements.btnSettings.addEventListener('click', openSettingsModal);
    }

    if (elements.btnSave) {
      elements.btnSave.addEventListener('click', () => saveInvoice(true));
    }

    if (elements.btnLoad) {
      elements.btnLoad.addEventListener('click', () => loadSavedInvoice(true));
    }

    if (elements.btnSampleData) {
      elements.btnSampleData.addEventListener('click', loadSampleData);
    }

    if (elements.btnClear) {
      elements.btnClear.addEventListener('click', clearInvoice);
    }

    if (elements.btnPrint) {
      elements.btnPrint.addEventListener('click', printInvoice);
    }

    // Modal Events
    if (elements.btnCloseModal) {
      elements.btnCloseModal.addEventListener('click', closeSettingsModal);
    }

    if (elements.modalBackdrop) {
      elements.modalBackdrop.addEventListener('click', closeSettingsModal);
    }

    if (elements.formSettings) {
      elements.formSettings.addEventListener('submit', handleSaveSettings);
    }

    if (elements.btnResetSettings) {
      elements.btnResetSettings.addEventListener('click', handleResetSettings);
    }

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.settingsModal && elements.settingsModal.classList.contains('is-open')) {
        closeSettingsModal();
      }
    });

    // Auto-save on customer field edits
    [elements.invNumber, elements.invDate, elements.invCustName, elements.invCustAddress].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          saveInvoice(false);
        });
      }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl + P or Cmd + P -> Handled by print stylesheet automatically, but save before print
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        saveInvoice(false);
      }
      // Alt + N -> Add new item row
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        addProductRow();
      }
      // Alt + S -> Save invoice
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveInvoice(true);
      }
    });
  }

  // ==========================================================================
  // TABLE RENDERING & DYNAMIC AUTO-EXTENDING ROWS
  // ==========================================================================
  function renderTable() {
    if (!elements.tbody) return;
    elements.tbody.innerHTML = '';

    const totalRowsToRender = Math.max(itemsData.length, MIN_PAD_ROWS);

    for (let i = 0; i < totalRowsToRender; i++) {
      const isExistingItem = i < itemsData.length;
      const item = isExistingItem ? itemsData[i] : { desc: '', hsn: '', qty: '', rate: '', amount: 0 };
      const tr = document.createElement('tr');
      tr.dataset.index = i;

      // In a physical pad, Sr. No. is only shown on rows that have data or are active
      const hasContent = item.desc || item.hsn || item.qty !== '' || item.rate !== '';
      const srText = (isExistingItem && hasContent) ? (i + 1) : '';

      tr.innerHTML = `
        <td class="td-sr">
          ${isExistingItem && hasContent ? `
            <div class="row-actions no-print">
              <button type="button" class="btn-row-del" title="Delete row" data-del-index="${i}">✕</button>
            </div>
          ` : ''}
          <span class="sr-num">${srText}</span>
        </td>
        <td class="td-desc">
          <textarea class="seamless-input input-desc" rows="1" placeholder="" autocomplete="off" spellcheck="false">${escapeHtml(item.desc)}</textarea>
        </td>
        <td class="td-hsn">
          <input type="text" class="seamless-input input-hsn" value="${escapeHtml(item.hsn)}" placeholder="" autocomplete="off">
        </td>
        <td class="td-qty">
          <input type="number" step="any" min="0" class="seamless-input input-qty" value="${item.qty !== '' ? item.qty : ''}" placeholder="" autocomplete="off">
        </td>
        <td class="td-rate">
          <input type="number" step="any" min="0" class="seamless-input input-rate" value="${item.rate !== '' ? item.rate : ''}" placeholder="" autocomplete="off">
        </td>
        <td class="td-amount">
          <span class="amount-val">${item.amount > 0 ? formatCurrency(item.amount) : ''}</span>
        </td>
      `;

      // Attach row event listeners and auto-resize
      attachRowEvents(tr, i);
      elements.tbody.appendChild(tr);

      // Auto-resize textarea to fit content
      const descTa = tr.querySelector('.input-desc');
      if (descTa && descTa.value) {
        descTa.style.height = 'auto';
        descTa.style.height = Math.max(21, descTa.scrollHeight) + 'px';
      }
    }
  }

  function attachRowEvents(tr, index) {
    const descInput = tr.querySelector('.input-desc');
    const hsnInput = tr.querySelector('.input-hsn');
    const qtyInput = tr.querySelector('.input-qty');
    const rateInput = tr.querySelector('.input-rate');
    const btnDel = tr.querySelector('.btn-row-del');

    if (btnDel) {
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRowAtIndex(index);
      });
    }

    // Auto-resize description textarea and extend row height
    const autoResizeDesc = () => {
      if (!descInput) return;
      descInput.style.height = 'auto';
      descInput.style.height = Math.max(21, descInput.scrollHeight) + 'px';
    };

    const handleInputChange = () => {
      // If typing in a filler row beyond itemsData length, expand itemsData
      if (index >= itemsData.length) {
        while (itemsData.length <= index) {
          itemsData.push({ desc: '', hsn: '', qty: '', rate: '', amount: 0 });
        }
      }

      const rowItem = itemsData[index];
      rowItem.desc = descInput ? descInput.value : '';
      rowItem.hsn = hsnInput ? hsnInput.value : '';
      rowItem.qty = qtyInput ? qtyInput.value : '';
      rowItem.rate = rateInput ? rateInput.value : '';

      calculateRowAmount(tr, index);
      calculateTotal();
      saveInvoice(false);
    };

    if (descInput) {
      descInput.addEventListener('input', () => {
        autoResizeDesc();
        handleInputChange();
      });
    }

    [hsnInput, qtyInput, rateInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', handleInputChange);
      }
    });
  }

  // ==========================================================================
  // ROW CALCULATIONS
  // ==========================================================================
  function calculateRowAmount(tr, index) {
    if (index >= itemsData.length) return;

    const rowItem = itemsData[index];
    const qty = parseFloat(rowItem.qty);
    const rate = parseFloat(rowItem.rate);

    let amount = 0;
    if (!isNaN(qty) && !isNaN(rate) && qty >= 0 && rate >= 0) {
      amount = Math.round(qty * rate * 100) / 100;
    }

    rowItem.amount = amount;

    const amountDisplay = tr.querySelector('.amount-val');
    if (amountDisplay) {
      amountDisplay.textContent = amount > 0 ? formatCurrency(amount) : '';
    }

    // Auto-update Sr. No. if row has data
    const srDisplay = tr.querySelector('.sr-num');
    const hasData = rowItem.desc || rowItem.hsn || rowItem.qty !== '' || rowItem.rate !== '';
    if (srDisplay) {
      srDisplay.textContent = hasData ? (index + 1) : '';
    }
  }

  function addProductRow(data = null) {
    const newItem = data || { desc: '', hsn: '', qty: '', rate: '', amount: 0 };
    itemsData.push(newItem);
    renderTable();
    calculateTotal();

    // Auto-focus on new row's description
    if (elements.tbody) {
      const lastRowIndex = itemsData.length - 1;
      const rows = elements.tbody.querySelectorAll('tr');
      if (rows[lastRowIndex]) {
        const desc = rows[lastRowIndex].querySelector('.input-desc');
        if (desc) desc.focus();
      }
    }
  }

  function removeProductRow() {
    if (itemsData.length <= 1) {
      itemsData[0] = { desc: '', hsn: '', qty: '', rate: '', amount: 0 };
      renderTable();
      calculateTotal();
      showToast('Cleared first item');
      return;
    }

    itemsData.pop();
    renderTable();
    calculateTotal();
    saveInvoice(false);
    showToast('Last item removed');
  }

  function deleteRowAtIndex(index) {
    if (itemsData.length <= 1) {
      itemsData[0] = { desc: '', hsn: '', qty: '', rate: '', amount: 0 };
    } else {
      itemsData.splice(index, 1);
    }
    renderTable();
    calculateTotal();
    saveInvoice(false);
    showToast('Item deleted');
  }

  // ==========================================================================
  // GRAND TOTAL & INDIAN CURRENCY NUMBER-TO-WORDS
  // ==========================================================================
  function calculateTotal() {
    let subtotal = 0;
    itemsData.forEach(item => {
      const amt = parseFloat(item.amount);
      if (!isNaN(amt) && amt > 0) {
        subtotal += amt;
      }
    });

    subtotal = Math.round(subtotal * 100) / 100;

    let finalTotal = subtotal;
    const gstRate = parseFloat(companyProfile.gstPercent) || 0;
    if (gstRate > 0) {
      const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
      finalTotal = Math.round((subtotal + gstAmount) * 100) / 100;
    }

    // Display formatted Total
    if (elements.grandTotal) {
      elements.grandTotal.textContent = finalTotal > 0 ? formatCurrency(finalTotal) : '0.00';
    }

    // Display Amount in Words
    if (finalTotal > 0) {
      const words = numberToWordsIndian(finalTotal);
      splitWordsAcrossLines(words);
    } else {
      if (elements.amountWordsLine1) elements.amountWordsLine1.textContent = '';
      if (elements.amountWordsLine2) elements.amountWordsLine2.textContent = '';
    }
  }

  // Indian Numbering System to Words Converter (Crore, Lakh, Thousand, Hundred, Rupees & Paise)
  function numberToWordsIndian(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return '';
    const num = parseFloat(amount);
    if (num === 0) return 'Zero Rupees Only';

    const units = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertGroup(n) {
      let str = '';
      if (n >= 100) {
        str += units[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n >= 20) {
        str += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '') + ' ';
      } else if (n > 0) {
        str += units[n] + ' ';
      }
      return str.trim();
    }

    const rupees = Math.floor(Math.abs(num));
    const paise = Math.round((Math.abs(num) - rupees) * 100);

    const crore = Math.floor(rupees / 10000000);
    const remCrore = rupees % 10000000;
    const lakh = Math.floor(remCrore / 100000);
    const remLakh = remCrore % 100000;
    const thousand = Math.floor(remLakh / 1000);
    const remThousand = remLakh % 1000;

    let words = '';
    if (crore > 0) words += convertGroup(crore) + ' Crore ';
    if (lakh > 0) words += convertGroup(lakh) + ' Lakh ';
    if (thousand > 0) words += convertGroup(thousand) + ' Thousand ';
    if (remThousand > 0) words += convertGroup(remThousand) + ' ';

    words = words.trim();

    let result = '';
    if (words) {
      result = words + ' Rupees';
      if (paise > 0) {
        result += ' and ' + convertGroup(paise) + ' Paise';
      }
    } else if (paise > 0) {
      result = convertGroup(paise) + ' Paise';
    } else {
      result = 'Zero Rupees';
    }

    result += ' Only';
    return result;
  }

  // Gracefully splits long words across the 2 printed ruled lines
  function splitWordsAcrossLines(fullWords) {
    const MAX_LINE1_CHARS = 46;
    if (!elements.amountWordsLine1) return;

    if (fullWords.length <= MAX_LINE1_CHARS) {
      elements.amountWordsLine1.textContent = fullWords;
      if (elements.amountWordsLine2) elements.amountWordsLine2.textContent = '';
      return;
    }

    // Find nearest space before MAX_LINE1_CHARS
    let splitIdx = fullWords.lastIndexOf(' ', MAX_LINE1_CHARS);
    if (splitIdx === -1) splitIdx = MAX_LINE1_CHARS;

    elements.amountWordsLine1.textContent = fullWords.substring(0, splitIdx).trim();
    if (elements.amountWordsLine2) {
      elements.amountWordsLine2.textContent = fullWords.substring(splitIdx).trim();
    }
  }

  // Formats currency standard (e.g. 1250 -> "1,250.00")
  function formatCurrency(val) {
    return Number(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // ==========================================================================
  // COMPANY SETTINGS & PROFILE
  // ==========================================================================
  function loadCompanySettings() {
    try {
      const stored = localStorage.getItem('a1_company_settings');
      if (stored) {
        companyProfile = Object.assign({}, DEFAULT_COMPANY, JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Could not read company settings from storage', e);
      companyProfile = { ...DEFAULT_COMPANY };
    }
    applyCompanyProfile();
  }

  function applyCompanyProfile() {
    if (elements.displayCompanyName) elements.displayCompanyName.textContent = companyProfile.name || DEFAULT_COMPANY.name;
    if (elements.displayCompanyAddress) elements.displayCompanyAddress.textContent = companyProfile.address || DEFAULT_COMPANY.address;
    if (elements.displayGstin) elements.displayGstin.textContent = companyProfile.gstin || DEFAULT_COMPANY.gstin;
    if (elements.displayPhone1) elements.displayPhone1.textContent = companyProfile.phone1 || DEFAULT_COMPANY.phone1;
    if (elements.displayPhone2) elements.displayPhone2.textContent = companyProfile.phone2 || DEFAULT_COMPANY.phone2;
    if (elements.displaySignCompany) elements.displaySignCompany.textContent = companyProfile.name || DEFAULT_COMPANY.name;

    // Populate modal inputs
    if (elements.cfgCompanyName) elements.cfgCompanyName.value = companyProfile.name;
    if (elements.cfgGstin) elements.cfgGstin.value = companyProfile.gstin;
    if (elements.cfgAddress) elements.cfgAddress.value = companyProfile.address;
    if (elements.cfgPhone1) elements.cfgPhone1.value = companyProfile.phone1;
    if (elements.cfgPhone2) elements.cfgPhone2.value = companyProfile.phone2;
    if (elements.cfgGstPercent) {
      elements.cfgGstPercent.value = companyProfile.gstPercent !== undefined ? companyProfile.gstPercent : 0;
    }
  }

  function openSettingsModal() {
    if (!elements.settingsModal) return;
    elements.settingsModal.classList.add('is-open');
    elements.settingsModal.setAttribute('aria-hidden', 'false');
    if (elements.cfgCompanyName) elements.cfgCompanyName.focus();
  }

  function closeSettingsModal() {
    if (!elements.settingsModal) return;
    elements.settingsModal.classList.remove('is-open');
    elements.settingsModal.setAttribute('aria-hidden', 'true');
  }

  function handleSaveSettings(e) {
    e.preventDefault();
    companyProfile.name = (elements.cfgCompanyName && elements.cfgCompanyName.value.trim()) || DEFAULT_COMPANY.name;
    companyProfile.gstin = (elements.cfgGstin && elements.cfgGstin.value.trim()) || DEFAULT_COMPANY.gstin;
    companyProfile.address = (elements.cfgAddress && elements.cfgAddress.value.trim()) || DEFAULT_COMPANY.address;
    companyProfile.phone1 = (elements.cfgPhone1 && elements.cfgPhone1.value.trim()) || DEFAULT_COMPANY.phone1;
    companyProfile.phone2 = (elements.cfgPhone2 && elements.cfgPhone2.value.trim()) || DEFAULT_COMPANY.phone2;
    if (elements.cfgGstPercent) {
      companyProfile.gstPercent = parseFloat(elements.cfgGstPercent.value) || 0;
    }

    try {
      localStorage.setItem('a1_company_settings', JSON.stringify(companyProfile));
    } catch (err) {
      console.error(err);
    }

    applyCompanyProfile();
    calculateTotal();
    closeSettingsModal();
    showToast('Company details updated');
  }

  function handleResetSettings() {
    if (confirm('Reset company details to original receipt book defaults?')) {
      companyProfile = { ...DEFAULT_COMPANY };
      try {
        localStorage.removeItem('a1_company_settings');
      } catch (err) {}
      applyCompanyProfile();
      calculateTotal();
      closeSettingsModal();
      showToast('Reset to original A 1 ENTERPRISES details');
    }
  }

  // ==========================================================================
  // STORAGE (SAVE / LOAD / CLEAR)
  // ==========================================================================
  function saveInvoice(showToastMsg = true) {
    const invoiceData = {
      invNumber: elements.invNumber ? elements.invNumber.value : '',
      invDate: elements.invDate ? elements.invDate.value : '',
      custName: elements.invCustName ? elements.invCustName.value : '',
      custAddress: elements.invCustAddress ? elements.invCustAddress.value : '',
      items: itemsData.filter(it => it.desc || it.hsn || it.qty || it.rate)
    };

    try {
      localStorage.setItem('a1_invoice_current', JSON.stringify(invoiceData));
      if (showToastMsg) {
        showToast('Invoice saved successfully');
      }
    } catch (e) {
      console.error('Failed to save to localStorage', e);
      if (showToastMsg) {
        showToast('Failed to save invoice');
      }
    }
  }

  function loadSavedInvoice(showToastMsg = true) {
    try {
      const saved = localStorage.getItem('a1_invoice_current');
      if (!saved) {
        if (showToastMsg) showToast('No saved invoice found');
        return;
      }

      const invoiceData = JSON.parse(saved);
      if (invoiceData.invNumber && elements.invNumber) elements.invNumber.value = invoiceData.invNumber;
      if (invoiceData.invDate && elements.invDate) elements.invDate.value = invoiceData.invDate;
      if (invoiceData.custName !== undefined && elements.invCustName) elements.invCustName.value = invoiceData.custName;
      if (invoiceData.custAddress !== undefined && elements.invCustAddress) elements.invCustAddress.value = invoiceData.custAddress;

      if (Array.isArray(invoiceData.items) && invoiceData.items.length > 0) {
        itemsData = invoiceData.items.map(it => {
          const qty = parseFloat(it.qty);
          const rate = parseFloat(it.rate);
          const amount = (!isNaN(qty) && !isNaN(rate)) ? Math.round(qty * rate * 100) / 100 : 0;
          return {
            desc: it.desc || '',
            hsn: it.hsn || '',
            qty: it.qty !== undefined ? it.qty : '',
            rate: it.rate !== undefined ? it.rate : '',
            amount: amount
          };
        });
      } else {
        itemsData = [{ desc: '', hsn: '', qty: '', rate: '', amount: 0 }];
      }

      renderTable();
      calculateTotal();
      if (showToastMsg) showToast('Invoice loaded from storage');
    } catch (e) {
      console.error('Failed to load invoice from localStorage', e);
      if (showToastMsg) showToast('Error loading saved invoice');
    }
  }

  function clearInvoice() {
    if (!confirm('Are you sure you want to clear all fields?')) return;

    if (elements.invNumber) elements.invNumber.value = '166';
    setDefaultDate();
    if (elements.invCustName) elements.invCustName.value = '';
    if (elements.invCustAddress) elements.invCustAddress.value = '';
    itemsData = [{ desc: '', hsn: '', qty: '', rate: '', amount: 0 }];

    renderTable();
    calculateTotal();
    try {
      localStorage.removeItem('a1_invoice_current');
    } catch (e) {}

    showToast('Invoice cleared');
  }

  // ==========================================================================
  // SAMPLE DATA
  // ==========================================================================
  function loadSampleData() {
    if (elements.invNumber) elements.invNumber.value = '166';
    setDefaultDate();
    if (elements.invCustName) elements.invCustName.value = 'Rameshwar Computer & Electricals';
    if (elements.invCustAddress) elements.invCustAddress.value = 'Shop 14, Main Road, Market Yard, Pune - 411037';

    itemsData = [
      { desc: 'Crucial DDR4 8GB Desktop RAM 3200MHz', hsn: '8473', qty: '2', rate: '1450', amount: 2900 },
      { desc: 'Kingston NV2 500GB M.2 NVMe SSD', hsn: '8471', qty: '1', rate: '2850', amount: 2850 },
      { desc: 'Logitech MK215 Wireless Keyboard & Mouse Combo', hsn: '8471', qty: '3', rate: '1250', amount: 3750 },
      { desc: 'High Speed HDMI 2.0 Cable 1.5M Gold Plated', hsn: '8544', qty: '5', rate: '180', amount: 900 }
    ];

    renderTable();
    calculateTotal();
    saveInvoice(false);
    showToast('Sample data loaded');
  }

  // ==========================================================================
  // EXPORT AS PNG & PDF — DIRECT TO DEVICE DOWNLOAD
  // ==========================================================================
  function prepareClonedInvoiceForCapture(clonedDoc) {
    // Hide UI-only helpers or non-printable elements
    const noPrintEls = clonedDoc.querySelectorAll('.no-print');
    noPrintEls.forEach(el => { el.style.display = 'none'; });

    // On mobile, reset any scroll containers and enforce standard paper geometry in clone
    const clonedWrapper = clonedDoc.getElementById('paper-scroll-wrapper');
    if (clonedWrapper) {
      clonedWrapper.style.overflow = 'visible';
      clonedWrapper.style.transform = 'none';
      clonedWrapper.scrollLeft = 0;
    }

    const clonedWorkspace = clonedDoc.querySelector('.workspace-container');
    if (clonedWorkspace) {
      clonedWorkspace.style.padding = '0';
      clonedWorkspace.style.margin = '0';
    }

    const clonedInvoice = clonedDoc.getElementById('invoice-paper');
    if (clonedInvoice) {
      clonedInvoice.style.transform = 'none';
      clonedInvoice.style.margin = '0 auto';
      clonedInvoice.style.boxShadow = 'none';
      clonedInvoice.style.padding = '24px';
      clonedInvoice.style.width = '760px';
    }

    // Ensure all table rows maintain authentic 28px height, while multi-line rows expand naturally
    const trs = clonedDoc.querySelectorAll('#product-rows-body tr');
    trs.forEach(tr => {
      tr.style.height = '28px';
    });

    // Ensure the table header horizontal divider line is explicitly solid black and crisp in export
    const thElements = clonedDoc.querySelectorAll('#receipt-table th');
    thElements.forEach(th => {
      th.style.borderBottom = '1.5px solid #000000';
      th.style.borderColor = '#000000';
    });

    const theadTr = clonedDoc.querySelector('#receipt-table thead tr');
    if (theadTr) {
      theadTr.style.borderBottom = '1.5px solid #000000';
    }

    const firstBodyTds = clonedDoc.querySelectorAll('#product-rows-body tr:first-child td');
    firstBodyTds.forEach(td => {
      td.style.borderTop = '1px solid #000000';
    });

    // Replace inputs and textareas with standard spans to eliminate html2canvas baseline clipping bug
    const inputs = clonedDoc.querySelectorAll('#invoice-paper input, #invoice-paper textarea');
    inputs.forEach(inp => {
      const span = clonedDoc.createElement('span');
      span.textContent = inp.value || '';
      span.className = inp.className;
      const comp = window.getComputedStyle(inp);
      span.style.fontFamily = comp.fontFamily;
      span.style.fontSize = comp.fontSize;
      span.style.fontWeight = comp.fontWeight;
      span.style.color = '#000000';
      span.style.textAlign = comp.textAlign;
      span.style.boxSizing = 'border-box';
      span.style.padding = '0 2px';

      if (inp.closest('td')) {
        span.style.display = 'block';
        span.style.width = '100%';
        span.style.minHeight = '21px'; // Prevents empty rows from collapsing in export

        if (inp.classList.contains('input-desc')) {
          span.style.whiteSpace = 'pre-wrap';
          span.style.wordBreak = 'break-word';
          span.style.overflow = 'visible';
          span.style.lineHeight = '1.35';
        } else {
          span.style.overflow = 'hidden';
          span.style.whiteSpace = 'nowrap';
          span.style.lineHeight = '1.25';
        }
      } else {
        span.style.display = 'inline-block';
        span.style.width = inp.classList.contains('line-input') ? '100%' : 'auto';
        span.style.verticalAlign = 'baseline';
      }

      if (inp.parentNode) {
        inp.parentNode.replaceChild(span, inp);
      }
    });
  }

  // Direct-to-Device File Downloader (Direct download on PC, Android, and iOS)
  function downloadDirectFile(blob, fileName) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = blobUrl;
    link.download = fileName;
    link.rel = 'noopener';

    // Required by iOS Safari, Firefox, and Android Chrome
    document.body.appendChild(link);
    link.click();

    // Clean up DOM and revoke Blob URL
    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      URL.revokeObjectURL(blobUrl);
    }, 15000);

    showToast('Downloaded ' + fileName);
  }

  async function downloadPNG() {
    const invoiceEl = document.getElementById('invoice-paper');
    if (!invoiceEl) return;

    showToast('Generating high-resolution PNG...');

    const origTransform = invoiceEl.style.transform;
    invoiceEl.style.transform = 'none';

    try {
      if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas library is not loaded');
      }

      // Configure html2canvas to render full desktop invoice dimensions even on mobile screens
      const canvas = await html2canvas(invoiceEl, {
        scale: 2, // 2x high DPI crisp print resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: invoiceEl.offsetWidth || 760,
        height: invoiceEl.offsetHeight,
        windowWidth: 1024,
        windowHeight: (invoiceEl.offsetHeight || 1050) + 100,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: prepareClonedInvoiceForCapture
      });

      invoiceEl.style.transform = origTransform;

      const rawNum = elements.invNumber ? elements.invNumber.value : '166';
      const invNum = (rawNum || '166').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = 'Invoice_' + invNum + '.png';

      // Convert canvas to real binary Blob and directly trigger device download
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) {
            showToast('Error generating PNG file');
            return;
          }
          downloadDirectFile(blob, fileName);
        }, 'image/png', 1.0);
      } else {
        // Fallback for older browsers
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (link.parentNode) link.parentNode.removeChild(link);
        }, 10000);
        showToast('Downloaded ' + fileName);
      }

    } catch (err) {
      invoiceEl.style.transform = origTransform;
      console.error('Error generating PNG:', err);
      showToast('Error generating PNG: ' + (err.message || err));
    }
  }

  async function downloadPDF() {
    const invoiceEl = document.getElementById('invoice-paper');
    if (!invoiceEl) return;

    showToast('Generating A4 PDF document...');

    const origTransform = invoiceEl.style.transform;
    invoiceEl.style.transform = 'none';

    try {
      if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas library is not loaded');
      }
      if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
        throw new Error('jsPDF library is not loaded');
      }

      // Configure html2canvas to render full desktop invoice dimensions even on mobile screens
      const canvas = await html2canvas(invoiceEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: invoiceEl.offsetWidth || 760,
        height: invoiceEl.offsetHeight,
        windowWidth: 1024,
        windowHeight: (invoiceEl.offsetHeight || 1050) + 100,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: prepareClonedInvoiceForCapture
      });

      invoiceEl.style.transform = origTransform;

      const jsPDFClass = window.jspdf ? window.jspdf.jsPDF : jsPDF;
      // Standard A4 portrait: 210mm x 297mm
      const pdf = new jsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 8;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight, '', 'FAST');

      const rawNum = elements.invNumber ? elements.invNumber.value : '166';
      const invNum = (rawNum || '166').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = 'Invoice_' + invNum + '.pdf';

      // Output real binary Blob and directly trigger device download
      const pdfBlob = pdf.output('blob');
      downloadDirectFile(pdfBlob, fileName);

    } catch (err) {
      invoiceEl.style.transform = origTransform;
      console.error('Error generating PDF:', err);
      showToast('Error generating PDF: ' + (err.message || err));
    }
  }

  function printInvoice() {
    // Validate required fields
    if (elements.invNumber && !elements.invNumber.value.trim()) {
      alert('Please enter an Invoice / Receipt Number before printing.');
      elements.invNumber.focus();
      return;
    }

    if (elements.invDate && !elements.invDate.value.trim()) {
      alert('Please enter an Invoice Date before printing.');
      elements.invDate.focus();
      return;
    }

    // Save before printing
    saveInvoice(false);

    // Trigger browser native print dialogue
    window.print();
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  function showToast(msg) {
    if (!elements.toast) return;
    elements.toast.textContent = msg;
    elements.toast.classList.add('show');
    clearTimeout(elements.toast._timer);
    elements.toast._timer = setTimeout(() => {
      elements.toast.classList.remove('show');
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ==========================================================================
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
