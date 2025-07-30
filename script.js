document.addEventListener('DOMContentLoaded', () => {
  // Inisialisasi ikon Lucide
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch (e) { console.warn('Lucide init warning:', e); }

  // ====== KONFIGURASI PASSWORD ======
  const TASK_PASSWORD = '1111';

  // ====== NAV BOTTOM / TAB ======
  const barButtons = Array.from(document.querySelectorAll('.bar-item'));
  const panes = Array.from(document.querySelectorAll('.tab-pane'));
  setActive('tab-beranda');

  barButtons.forEach(btn => {
    btn.addEventListener('click', () => setActive(btn.getAttribute('data-target')));
  });

  function setActive(targetId) {
    barButtons.forEach(b => b.classList.toggle('is-active', b.getAttribute('data-target') === targetId));

    // animasi keluar/masuk tab
    panes.forEach(p => {
      const isTarget = p.id === targetId;
      if (isTarget) {
        p.classList.add('is-active');
        // trigger reflow untuk memulai animasi fade-in
        // eslint-disable-next-line no-unused-expressions
        p.offsetHeight;
        p.classList.add('fade-in');
      } else {
        p.classList.remove('fade-in');
        p.classList.remove('is-active');
      }
    });

    refreshIcons();
  }

  // ====== TASK APP ======
  const form = document.getElementById('task-form');
  const tbody = document.getElementById('task-tbody');            // daftar di tab Jadwal
  const jobdeskTbody = document.getElementById('jobdesk-tbody');  // daftar di tab Job Desk
  const clearBtn = document.getElementById('clear-tasks');
  const fotoInput = document.getElementById('foto');
  const STORAGE_KEY = 'tasks';

  // Load tasks dari LocalStorage -> sort by createdAt desc
  let tasks = loadTasksSorted();
  renderTasks();

  // Submit form (dengan password)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!checkPassword('Untuk menyimpan tugas, masukkan password')) {
        alert('Password salah. Tugas tidak disimpan.');
        return;
      }

      const data = getFormData();
      if (!data.namaPekerjaan) {
        alert('Nama pekerjaan wajib diisi.');
        return;
      }

      // Proses foto (opsional)
      let photoDataUrl = null;
      const file = (fotoInput && fotoInput.files && fotoInput.files[0]) ? fotoInput.files[0] : null;
      if (file) {
        try {
          photoDataUrl = await compressImageFile(file, 1280, 1280, 0.8); // kompres otomatis
        } catch (err) {
          console.warn('Gagal kompres foto, simpan asli:', err);
          photoDataUrl = await fileToDataURL(file);
        }
      }

      const newTask = { id: uid(), createdAt: Date.now(), photo: photoDataUrl, ...data };
      tasks.unshift(newTask);
      saveTasks(tasks);
      renderTasks();
      form.reset();
    });
  }

  // Hapus semua
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!confirm('Hapus semua tugas?')) return;
      if (!checkPassword('Untuk menghapus semua tugas, masukkan password')) {
        alert('Password salah. Tidak ada yang dihapus.');
        return;
      }
      tasks = [];
      saveTasks(tasks);
      renderTasks();
    });
  }

  // Delegasi aksi tabel: hapus / selesai (hapus dari list)
  if (tbody) tbody.addEventListener('click', tableActionHandler);
  if (jobdeskTbody) jobdeskTbody.addEventListener('click', tableActionHandler);

  function tableActionHandler(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');

    if (action === 'delete') {
      if (!checkPassword('Untuk menghapus tugas ini, masukkan password')) {
        alert('Password salah. Tugas tidak dihapus.');
        return;
      }
      tasks = tasks.filter(t => t.id !== id);
      saveTasks(tasks);
      renderTasks();
    }

    if (action === 'done') {
      if (!checkPassword('Untuk menandai selesai, masukkan password')) {
        alert('Password salah. Status tidak diubah.');
        return;
      }
      // Selesai = hapus dari daftar (mengikuti logika yang Anda pakai)
      tasks = tasks.filter(t => t.id !== id);
      saveTasks(tasks);
      renderTasks();
    }
  }

  // ====== Helpers ======
  function checkPassword(message = 'Masukkan password') {
    const input = prompt(message, '');
    return input === TASK_PASSWORD;
  }

  function getFormData() {
    return {
      namaPekerjaan: byId('namaPekerjaan').value.trim(),
      area: byId('area').value.trim(),
      pembuat: byId('pembuat').value.trim(),
      penerima: byId('penerima').value.trim(),
      tanggalPengerjaan: byId('tanggalPengerjaan').value || '',
      dueDate: byId('dueDate').value || '',
      durasiJam: (function () {
        const v = byId('durasiJam')?.value;
        if (v === undefined || v === null || v === '') return '';
        const n = Number(v);
        return isFinite(n) && n >= 0 ? n : '';
      })()
    };
  }

  function renderTasks() {
    renderTasksInto(tbody);
    renderTasksInto(jobdeskTbody);
    refreshIcons();
  }

  function renderTasksInto(container) {
    if (!container) return;
    container.innerHTML = '';

    // Hitung jumlah kolom dari thead agar colspan dinamis
    const colCount = container.closest('table')?.querySelectorAll('thead th').length || 8;

    if (!tasks.length) {
      container.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; color:#6b7280; padding:14px">Belum ada tugas.</td></tr>`;
      return;
    }

    const rows = tasks.map(t => {
      const tglKerja = t.tanggalPengerjaan ? fmtDate(t.tanggalPengerjaan) : '-';
      const due = t.dueDate ? fmtDate(t.dueDate) : '-';
      const dur = (t.durasiJam !== undefined && t.durasiJam !== '' && t.durasiJam !== null)
        ? fmtHours(t.durasiJam)
        : '-';
      const photoCell = t.photo
        ? `<a href="${t.photo}" target="_blank" rel="noopener">
             <img class="thumb" src="${t.photo}" alt="Foto ${esc(t.namaPekerjaan)}" />
           </a>`
        : '-';

      return `
        <tr>
          <td>${esc(t.namaPekerjaan)}</td>
          <td>${esc(t.area || '-')}</td>
          <td>${esc(t.pembuat || '-')}</td>
          <td>${esc(t.penerima || '-')}</td>
          <td>${tglKerja}</td>
          <td>${due}</td>
          <td>${dur}</td>
          <td class="photo-cell">${photoCell}</td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" title="Tandai selesai" aria-label="Tandai selesai" data-action="done" data-id="${t.id}">
                <i data-lucide="check-circle-2"></i>
              </button>
              <button class="icon-btn" title="Hapus" aria-label="Hapus" data-action="delete" data-id="${t.id}">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = rows;
  }

  // Format helpers
  function fmtDate(yyyy_mm_dd) {
    const [y,m,d] = (yyyy_mm_dd || '').split('-').map(Number);
    if (!y || !m || !d) return '-';
    return String(d).padStart(2,'0') + '/' + String(m).padStart(2,'0') + '/' + y;
  }
  function fmtHours(n) {
    const num = Number(n);
    if (!isFinite(num)) return '-';
    const s = Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/,'');
    return s + ' jam';
  }

  function saveTasks(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('localStorage error:', e);
      alert('Penyimpanan lokal penuh/terkunci. Coba hapus beberapa tugas atau matikan Mode Private.');
    }
  }

  function loadTasksSorted() {
    let data;
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { data = []; }

    const now = Date.now();
    let fallback = data.length;
    data = data.map(t => {
      if (typeof t.createdAt !== 'number') {
        t.createdAt = now - (fallback-- * 1000);
      }
      return t;
    });

    data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return data;
  }

  // ==== Image helpers ====
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function compressImageFile(file, maxW = 1280, maxH = 1280, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const { canvas, ctx } = createCanvasToFit(img, maxW, maxH);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = fr.result;
      };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function createCanvasToFit(img, maxW, maxH) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let { width, height } = img;
    const ratio = Math.min(maxW / width, maxH / height, 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    return { canvas, ctx };
  }

  // Utils
  function byId(id) { return document.getElementById(id); }
  function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function esc(str='') {
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
  function refreshIcons() {
    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    } catch (e) { /* no-op */ }
  }

  // ====== ALL MEMBERS ======
  const btnAllMembers = document.getElementById('beranda-members');
  const btnMembersBack = document.getElementById('members-back');
  btnAllMembers?.addEventListener('click', () => setActive('tab-members'));
  btnMembersBack?.addEventListener('click', () => setActive('tab-beranda'));

  // ====== INTERAKSI: Ripple + Press Animation ======
  initPressAndRipple('.app-button, .btn, .bar-item');

  function initPressAndRipple(selector) {
    const nodes = document.querySelectorAll(selector);
    nodes.forEach(el => {
      // pastikan posisi relatif untuk ripple
      if (getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
      el.style.overflow = el.style.overflow || 'hidden';

      el.addEventListener('pointerdown', (e) => {
        el.classList.add('is-pressing');

        // ripple
        const rect = el.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.2;
        const ripple = document.createElement('span');
        ripple.className = 'ripple-circle';
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top  = `${e.clientY - rect.top  - size / 2}px`;
        el.appendChild(ripple);

        ripple.addEventListener('animationend', () => {
          ripple.remove();
        }, { once: true });
      });

      const release = () => el.classList.remove('is-pressing');
      el.addEventListener('pointerup', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('pointercancel', release);
    });
  }

  // ====== Bounce Scroll ala Android ======
  initBounceScroll();

  function initBounceScroll() {
    const content = document.querySelector('.app-content') || document.documentElement;
    let startY = 0;
    let pulling = false;
    let atTop = false;
    let atBottom = false;

    const damp = (dy) => {
      // redam gerak; maksimal 90px
      const v = Math.max(-90, Math.min(90, dy * 0.35));
      return v;
    };

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      const scroller = document.scrollingElement || document.documentElement;
      atTop = scroller.scrollTop <= 0;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight - 1;
      atBottom = scroller.scrollTop >= maxScroll;
      pulling = false;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;

      // tarik ke bawah di atas atau tarik ke atas di bawah
      if ((atTop && dy > 0) || (atBottom && dy < 0)) {
        e.preventDefault(); // hentikan scroll normal untuk efek bounce
        pulling = true;
        const offset = damp(dy);
        content.style.transform = `translateY(${offset}px)`;
      }
    }, { passive: false });

    const end = () => {
      if (!pulling) return;
      pulling = false;
      content.style.transition = 'transform 320ms cubic-bezier(.22,.61,.36,1)'; // ease-out
      content.style.transform = 'translateY(0px)';
      content.addEventListener('transitionend', () => {
        content.style.transition = '';
      }, { once: true });
    };

    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });
  }
});