async function handleLogin(page, studentId, password) {
    try {
        console.log("[*] جاري تسجيل الدخول في منصة Qureo...");
        await page.goto('https://me-portal.qureo.education/login', { waitUntil: 'networkidle2' });
        
        await page.type('input[name="student_id"]', studentId);
        await page.type('input[name="password"]', password);
        
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);
        
        console.log("[+] تم تسجيل الدخول بنجاح وتجاوز الصفحة!");
        return true;
    } catch (error) {
        console.error("[-] تعذر تسجيل الدخول:", error);
        return false;
    }
}

module.exports = { handleLogin };
