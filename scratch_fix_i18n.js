const fs = require('fs');

const injectKeys = (filePath, section, newKeys) => {
    let content = fs.readFileSync(filePath, 'utf8');
    const regex = new RegExp('(' + section + ':\\s*\\{)', 'g');
    if (regex.test(content)) {
        content = content.replace(regex, `$1\n${newKeys}`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated ' + filePath + ' for ' + section);
    } else {
        console.log('Section ' + section + ' not found in ' + filePath);
    }
};

const keysFaChannel = `		displayInName: 'نمایش در نام گروه',
		displayInNameDesc: 'افزودن متغیرها به نام گروه',
		varGram: 'قیمت Gram',
		guideTitleGroup: 'راهنمای بیوگرافی و نام زنده',
		guideDescGroup: 'با فعال‌سازی این بخش، می‌توانید نام و بیوگرافی گروه خود را به صورت زنده و خودکار با اطلاعاتی نظیر زمان، تاریخ و قیمت‌های لحظه‌ای رمزارزها (مثل بیت‌کوین و گرام) به‌روزرسانی کنید. کافیست این گزینه را روشن کنید تا به تنظیمات قالب و متغیرها دسترسی داشته باشید.',
		subtitle2: 'آپدیت لحظه‌ای اطلاعات گروه با متغیرها',
		currentStatusTelegram: 'وضعیت فعلی در تلگرام:',
		currentNameLabel: 'نام فعلی: ',
		currentBioLabel: 'بیوگرافی فعلی: ',`;

const keysEnChannel = `		displayInName: 'Display in Group Name',
		displayInNameDesc: 'Add dynamic tags to the group name',
		varGram: 'Gram price',
		guideTitleGroup: 'Dynamic Bio & Name Guide',
		guideDescGroup: 'By enabling this section, you can automatically update your group name and bio with live information such as time, date, and crypto prices (like Bitcoin and Gram). Turn this on to access template settings and variables.',
		subtitle2: 'Real-time group info updates with variables',
		currentStatusTelegram: 'Current status in Telegram:',
		currentNameLabel: 'Current Name: ',
		currentBioLabel: 'Current Bio: ',`;

const keysZhChannel = `		displayInName: '显示在群组名称中',
		displayInNameDesc: '将动态标签添加到群组名称',
		varGram: 'Gram 价格',
		guideTitleGroup: '动态简介与名称指南',
		guideDescGroup: '启用此部分后，您可以使用时间、日期和加密货币价格（如比特币和 Gram）等实时信息自动更新您的群组/频道名称和简介。开启此选项以访问模板设置和变量。',
		subtitle2: '使用变量实时更新群组信息',
		currentStatusTelegram: 'Telegram 中的当前状态：',
		currentNameLabel: '当前名称：',
		currentBioLabel: '当前简介：',`;

const keysRuChannel = `		displayInName: 'Отображать в названии',
		displayInNameDesc: 'Добавить динамические теги в название',
		varGram: 'Цена Gram',
		guideTitleGroup: 'Руководство по динамическому био',
		guideDescGroup: 'Включив этот раздел, вы можете автоматически обновлять название и био группы с помощью времени, даты и цен на криптовалюты. Включите, чтобы получить доступ к настройкам.',
		subtitle2: 'Обновление информации группы в реальном времени',
		currentStatusTelegram: 'Текущий статус в Telegram:',
		currentNameLabel: 'Текущее имя: ',
		currentBioLabel: 'Текущее био: ',`;

const keysFaBot = `		createCustomBotTitle: 'ربات برند اختصاصی خود را بسازید',
		createCustomBotDesc: 'ربات اختصاصی خود را با نام و لوگوی دلخواه وصل کنید تا امکانات پیشرفته مدیریت گروه فعال شود و درآمد کسب کنید.',
		featureBrandTitle: 'نام و لوگوی اختصاصی',
		featureBrandDesc: 'ربات با برند، تصویر و بیوگرافی شخصی شما اجرا می‌شود.',
		featureProtectTitle: 'مدیریت و امنیت کامل',
		featureProtectDesc: 'ضد اسپم، مدیریت ساعت سکوت و محدودیت‌های رسانه.',
		featureEarnTitle: 'کسب درآمد و کارمزد توکن',
		featureEarnDesc: 'از فروش بسته‌های ارتقای گروه پورسانت بگیرید.',
		botFatherBtn: 'ورود به BotFather@ و ساخت ربات',`;

const keysEnBot = `		createCustomBotTitle: 'Create Your Custom Bot',
		createCustomBotDesc: 'Connect your custom brand bot to access powerful group/channel tools and get exclusive developer benefits.',
		featureBrandTitle: 'Custom Brand & Logo',
		featureBrandDesc: 'Your own bot name, photo, and bio.',
		featureProtectTitle: 'Full Group Protection',
		featureProtectDesc: 'Spam blocker, quiet hours & restrictions.',
		featureEarnTitle: 'Earn FRG Commissions',
		featureEarnDesc: 'Get paid from group package upgrades.',
		botFatherBtn: 'Create Bot via @BotFather',`;

const keysZhBot = `		createCustomBotTitle: '创建您的专属机器人',
		createCustomBotDesc: '连接您的专属品牌机器人以使用强大的群组/频道工具并获得独家开发者福利。',
		featureBrandTitle: '专属品牌与徽标',
		featureBrandDesc: '您自己的机器人名称、照片和个人简介。',
		featureProtectTitle: '全面的群组保护',
		featureProtectDesc: '垃圾邮件拦截、免打扰时间和限制功能。',
		featureEarnTitle: '赚取 FRG 佣金',
		featureEarnDesc: '从群组套餐升级中获得分成。',
		botFatherBtn: '通过 @BotFather 创建机器人',`;

const keysRuBot = `		createCustomBotTitle: 'Создайте своего бота',
		createCustomBotDesc: 'Подключите своего собственного бота для доступа к инструментам группы и получения бонусов.',
		featureBrandTitle: 'Свой бренд и логотип',
		featureBrandDesc: 'Собственное имя, фото и био бота.',
		featureProtectTitle: 'Полная защита группы',
		featureProtectDesc: 'Антиспам, тихие часы и ограничения.',
		featureEarnTitle: 'Зарабатывайте комиссии FRG',
		featureEarnDesc: 'Получайте процент от покупок в группе.',
		botFatherBtn: 'Создать бота через @BotFather',`;

injectKeys('c:/Users/DEll/Desktop/iFragment/frontend/src/shared/i18n/fa.ts', 'channelDynamicBio', keysFaChannel);
injectKeys('c:/Users/DEll/Desktop/iFragment/frontend/src/shared/i18n/en.ts', 'channelDynamicBio', keysEnChannel);
injectKeys('c:/Users/DEll/Desktop/iFragment/frontend/src/shared/i18n/zh.ts', 'channelDynamicBio', keysZhChannel);
injectKeys('c:/Users/DEll/Desktop/iFragment/frontend/src/shared/i18n/ru.ts', 'channelDynamicBio', keysRuChannel);

injectKeys('c:/Users/DEll/Desktop/iFragment/frontend/src/shared/i18n/fa.ts', 'managedBots', keysFaBot);
injectKeys('c:/Users/DEll/Desktop/iFragment/frontend/src/shared/i18n/en.ts', 'managedBots', keysEnBot);
injectKeys('c:/Users/DEll/Desktop/iFragment/frontend/src/shared/i18n/zh.ts', 'managedBots', keysZhBot);
injectKeys('c:/Users/DEll/Desktop/iFragment/frontend/src/shared/i18n/ru.ts', 'managedBots', keysRuBot);
