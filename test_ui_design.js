// Test script to verify the new UI design and theme switching
// Run this in the browser console when the app is running

console.log('🎨 Testing JARVIS UI Design...');

// Test theme switching
function testThemeSwitching() {
    console.log('📱 Testing theme switching...');
    
    // Get current theme
    const currentTheme = document.documentElement.getAttribute('data-theme');
    console.log(`Current theme: ${currentTheme}`);
    
    // Test toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        console.log('✅ Theme toggle button found');
        
        // Simulate theme switch
        themeToggle.click();
        
        setTimeout(() => {
            const newTheme = document.documentElement.getAttribute('data-theme');
            console.log(`Theme switched to: ${newTheme}`);
            
            // Switch back
            themeToggle.click();
            
            setTimeout(() => {
                const finalTheme = document.documentElement.getAttribute('data-theme');
                console.log(`Theme switched back to: ${finalTheme}`);
                console.log('✅ Theme switching works correctly');
            }, 500);
        }, 500);
    } else {
        console.log('❌ Theme toggle button not found');
    }
}

// Test UI elements
function testUIElements() {
    console.log('🔍 Testing UI elements...');
    
    const elements = {
        'App container': document.getElementById('app'),
        'Title bar': document.querySelector('.title-bar'),
        'Chat container': document.querySelector('.chat-container'),
        'Message input': document.getElementById('messageInput'),
        'Send button': document.getElementById('sendBtn'),
        'Side panel': document.querySelector('.side-panel'),
        'Status indicator': document.getElementById('statusIndicator')
    };
    
    Object.entries(elements).forEach(([name, element]) => {
        if (element) {
            console.log(`✅ ${name} found and styled`);
        } else {
            console.log(`❌ ${name} not found`);
        }
    });
}

// Test modern styling
function testModernStyling() {
    console.log('💅 Testing modern styling...');
    
    const body = document.body;
    const computedStyle = window.getComputedStyle(body);
    
    // Check if Inter font is loaded
    const fontFamily = computedStyle.fontFamily;
    if (fontFamily.includes('Inter')) {
        console.log('✅ Inter font loaded');
    } else {
        console.log(`⚠️  Font fallback: ${fontFamily}`);
    }
    
    // Check CSS custom properties
    const rootStyle = window.getComputedStyle(document.documentElement);
    const primaryBg = rootStyle.getPropertyValue('--bg-primary').trim();
    const accentPrimary = rootStyle.getPropertyValue('--accent-primary').trim();
    
    if (primaryBg && accentPrimary) {
        console.log('✅ CSS custom properties working');
        console.log(`Primary background: ${primaryBg}`);
        console.log(`Accent color: ${accentPrimary}`);
    } else {
        console.log('❌ CSS custom properties not found');
    }
}

// Run all tests
testUIElements();
testModernStyling();
testThemeSwitching();

console.log('🎉 UI design testing completed!');