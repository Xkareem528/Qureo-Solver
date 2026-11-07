
const $ = id => document.getElementById(id);
const apiStatus = $('apiStatus');

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? {'Content-Type':'application/json'} : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function loadStats() {
  $('statsMessage').textContent = 'جاري تحميل الإحصائيات...';
  try {
    const data = await api('/api/source-questions/stats');
    $('total').textContent = data.total;
    $('levels').textContent = data.levels.length;
    $('verified').textContent =
      data.review_statuses.find(x => x.status === 'verified')?.count ?? 0;

    const select = $('level');
    select.innerHTML = '<option value="">كل المستويات</option>' +
      data.levels.map(x =>
        `<option value="${Number(x.level)}">المستوى ${Number(x.level)} (${Number(x.count)} سؤال)</option>`
      ).join('');

    apiStatus.innerHTML = '<span class="good">● السيرفر متصل</span>';
    $('statsMessage').textContent =
      `تم تحميل ${data.total} سؤالًا من قاعدة البيانات بنجاح.`;
  } catch (error) {
    apiStatus.innerHTML = '<span class="bad">● تعذر الاتصال</span>';
    $('statsMessage').textContent = 'فشل تحميل الإحصائيات: ' + error.message;
  }
}

function renderCandidates(data) {
  const results = $('results');
  if (!data.candidates?.length) {
    results.innerHTML = '<div class="empty">لم يتم العثور على سؤال مطابق بدرجة كافية.</div>';
    return;
  }

  results.innerHTML = data.candidates.map(item => {
    const score = (Number(item.match_score) * 100).toFixed(2);
    const status = item.review_status === 'verified'
      ? '<span class="good">معتمدة</span>'
      : item.review_status === 'rejected'
        ? '<span class="bad">مرفوضة</span>'
        : item.review_status === 'classified_not_verified'
          ? '<span class="warn">مصنفة وغير معتمدة</span>'
          : '<span class="warn">بانتظار المراجعة</span>';

    const answer = item.original_answer
      ? `<div class="answer"><b>الإجابة المصدرية — غير معتمدة تلقائيًا:</b>\n${escapeHTML(item.original_answer)}</div>`
      : '<div class="answer">لا توجد إجابة مصدرية محفوظة لهذا السؤال.</div>';

    return `<article class="candidate">
      <h3>${escapeHTML(item.question_text)}</h3>
      <div class="meta">
        <span class="tag">المستوى ${Number(item.level)}</span>
        <span class="tag">${escapeHTML(item.lesson || 'درس غير محدد')}</span>
        <span class="tag">${escapeHTML(item.question_label || 'سؤال')}</span>
        <span class="tag">التشابه ${score}%</span>
        <span>${status}</span>
      </div>
      ${answer}
    </article>`;
  }).join('');
}

async function matchQuestion() {
  const question = $('question').value.trim();
  const level = $('level').value;
  if (!question) {
    $('matchMessage').textContent = 'اكتب نص السؤال أولًا.';
    $('question').focus();
    return;
  }

  const button = $('matchBtn');
  button.disabled = true;
  button.textContent = 'جاري البحث...';
  $('matchMessage').textContent = '';
  $('results').innerHTML = '';

  try {
    const data = await api('/api/source-questions/match', {
      method:'POST',
      body:JSON.stringify({
        question_text:question,
        ...(level ? {level:Number(level)} : {})
      })
    });

    const confidence = {
      high:'تطابق قوي',
      possible:'تطابق محتمل',
      none:'لا توجد مطابقة'
    }[data.match_confidence] || 'نتيجة البحث';

    $('matchMessage').textContent =
      `${confidence} — ${data.candidates.length} نتيجة.`;
    renderCandidates(data);
  } catch (error) {
    $('matchMessage').textContent = 'حدث خطأ: ' + error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'ابحث وطابق';
  }
}


function renderCourseProgress(user) {
  const root = $('courseProgress');
  const courses = user.courses || [];
  const errors = user.course_errors || [];

  if (!courses.length && !errors.length) {
    root.innerHTML = '<div class="empty">لم تصل بيانات كورسات.</div>';
    return;
  }

  root.innerHTML = courses.map(course => {
    const chapters = course.chapters || [];
    const rows = chapters.map(ch => `
      <article class="candidate">
        <div class="meta">
          <span class="tag">الفصل ${Number(ch.seq)}</span>
          <span>${escapeHTML(ch.name || 'بدون اسم')}</span>
          <span class="${ch.status === 'completed' ? 'good' : 'warn'}">
            ${ch.status === 'completed' ? 'مكتمل' : ch.status === 'incomplete' ? 'غير مكتمل' : 'بيانات غير متاحة'}
          </span>
        </div>
        <div class="hint">
          الأسئلة: ${Number(ch.question_count || 0)}
          ${ch.completed_at ? ' — تاريخ الإكمال: ' + escapeHTML(ch.completed_at) : ''}
        </div>
      </article>
    `).join('');

    return `
      <section class="card">
        <h2>${escapeHTML(course.name || course.content_id)}</h2>
        <div class="grid">
          <div class="stat"><strong>${Number(course.total_chapters || 0)}</strong><span>إجمالي الفصول</span></div>
          <div class="stat"><strong>${Number(course.completed_chapters || 0)}</strong><span>مكتملة</span></div>
          <div class="stat"><strong>${Number(course.incomplete_chapters || 0)}</strong><span>غير مكتملة</span></div>
        </div>
        ${rows}
      </section>
    `;
  }).join('') + errors.map(error => `
    <div class="notice">
      تعذر تحميل الكورس ${escapeHTML(error.content_id || '')}:
      ${escapeHTML(error.error || 'خطأ غير محدد')}
    </div>
  `).join('');
}

async function connectQureoAccount() {
  const button = $('connectBtn');
  const result = $('connectResult');
  const studentId = $('studentId').value.trim();
  const passwordInput = $('studentPassword');
  const password = passwordInput.value;

  if (!studentId || !password) {
    result.textContent = 'اكتب رقم الطالب وكلمة المرور.';
    return;
  }

  button.disabled = true;
  button.textContent = 'جاري تسجيل الدخول...';
  result.textContent = 'جاري الاتصال بمنصة QUREO...';
  $('courseProgress').innerHTML = '';

  try {
    const data = await api('/api/qureo/connect', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, password })
    });

    if (!data.authenticated || !data.user) {
      throw new Error(data.error || 'تعذر تسجيل الدخول.');
    }

    const user = data.user;
    const loaded = (user.courses || []).length;
    result.innerHTML =
      '<span class="good">تم تسجيل الدخول بنجاح.</span><br>' +
      'الكورسات المتاحة: ' + Number(user.available_courses?.length || 0) +
      '<br>الكورسات التي تم تحميلها: ' + loaded;

    renderCourseProgress(user);
  } catch (error) {
    result.textContent = 'فشل تسجيل الدخول أو جلب البيانات: ' + error.message;
  } finally {
    passwordInput.value = '';
    button.disabled = false;
    button.textContent = 'تسجيل الدخول وجلب التقدم';
  }
}

async function checkQureo() {
  const button = $('qureoBtn');
  button.disabled = true;
  button.textContent = 'جاري الفحص...';
  $('qureoResult').textContent = 'السيرفر يحاول فتح صفحة QUREO...';

  try {
    const data = await api('/api/qureo/status');
    const page = data.page || {};
    $('qureoResult').innerHTML =
      `<span class="good">● نجح فتح الصفحة</span><br>` +
      `نوع الصفحة: ${escapeHTML(data.pageType || 'غير محدد')}<br>` +
      `العنوان: ${escapeHTML(page.title || 'غير متاح')}<br>` +
      `الرابط: ${escapeHTML(page.url || 'غير متاح')}<br>` +
      `حالة التحميل: ${escapeHTML(page.readyState || 'غير متاحة')}<br>` +
      `حقول الإدخال الظاهرة: ${Number(page.fields?.length || 0)}<br>` +
      `أخطاء الصفحة: ${Number(page.pageErrors?.length || 0)}<br>` +
      `ملفات JavaScript المتعثرة: ${Number(page.failedScripts?.length || 0)}`;
  } catch (error) {
    $('qureoResult').innerHTML =
      `<span class="bad">● فشل فحص QUREO</span><br>${escapeHTML(error.message)}`;
  } finally {
    button.disabled = false;
    button.textContent = 'فحص الاتصال';
  }
}

$('matchBtn').addEventListener('click', matchQuestion);
$('clearBtn').addEventListener('click', () => {
  $('question').value = '';
  $('matchMessage').textContent = '';
  $('results').innerHTML = '';
  $('question').focus();
});
$('qureoBtn').addEventListener('click', checkQureo);
$('connectBtn').addEventListener('click', connectQureoAccount);
$('refreshBtn').addEventListener('click', loadStats);
$('question').addEventListener('keydown', event => {
  if (event.key === 'Enter') matchQuestion();
});

loadStats();
