const fs = require('fs');

const files = ['en.ts', 'fa.ts', 'ru.ts', 'zh.ts'];

const blocks = {
  'en.ts': `	airdropFinal: {
		friends: {
			title: 'Invite Frens!',
			subtitle: 'You and your fren will receive bonuses.',
			inviteBoxTitle: 'Invite a fren',
			inviteBoxDesc: '+10,000 for you and your fren',
			premiumBoxTitle: 'Fren with Telegram Premium',
			premiumBoxDesc: '+100,000 for you and your fren',
			listTitle: 'List of your frens',
			noFriends: 'You haven\\'t invited anyone yet',
			inviteBtn: 'Invite a fren',
			frensCount: 'frens'
		},
		clan: {
			title: 'Squads',
			subtitle: 'Join a squad to mine together',
			howItWorks: 'How it works',
			howItWorksDesc: 'Tap with your squad and get bonuses',
			joinTitle: 'Join a Squad',
			joinDesc: 'Enter squad username to join',
			joinBtn: 'Join',
			popularSquads: 'Popular Squads',
			noSquads: 'No squads found',
			members: 'members',
			inviteText: 'Join my squad {title} and let\\'s earn together!'
		},
		tap: {
			noClan: 'No squad',
			joinClan: 'Join a squad'
		}
	},`,
  'fa.ts': `	airdropFinal: {
		friends: {
			title: 'دعوت از دوستان!',
			subtitle: 'شما و دوستتان پاداش دریافت خواهید کرد.',
			inviteBoxTitle: 'دعوت یک دوست',
			inviteBoxDesc: '+۱۰,۰۰۰ برای شما و دوستتان',
			premiumBoxTitle: 'دوست با تلگرام پرمیوم',
			premiumBoxDesc: '+۱۰۰,۰۰۰ برای شما و دوستتان',
			listTitle: 'لیست دوستان شما',
			noFriends: 'شما هنوز کسی را دعوت نکرده‌اید',
			inviteBtn: 'دعوت از دوستان',
			frensCount: 'دوست'
		},
		clan: {
			title: 'تیم‌ها',
			subtitle: 'برای استخراج گروهی به یک تیم بپیوندید',
			howItWorks: 'نحوه کارکرد',
			howItWorksDesc: 'با تیم خود تب بزنید و پاداش بگیرید',
			joinTitle: 'پیوستن به تیم',
			joinDesc: 'نام کاربری تیم را برای ورود بنویسید',
			joinBtn: 'ورود',
			popularSquads: 'تیم‌های محبوب',
			noSquads: 'تیمی یافت نشد',
			members: 'عضو',
			inviteText: 'به تیم من {title} بپیوند و با هم کسب درآمد کنیم!'
		},
		tap: {
			noClan: 'بدون تیم',
			joinClan: 'پیوستن به تیم'
		}
	},`,
  'ru.ts': `	airdropFinal: {
		friends: {
			title: 'Пригласить друзей!',
			subtitle: 'Вы и ваш друг получите бонусы.',
			inviteBoxTitle: 'Пригласить друга',
			inviteBoxDesc: '+10,000 для вас и вашего друга',
			premiumBoxTitle: 'Друг с Telegram Premium',
			premiumBoxDesc: '+100,000 для вас и вашего друга',
			listTitle: 'Список ваших друзей',
			noFriends: 'Вы еще никого не пригласили',
			inviteBtn: 'Пригласить друга',
			frensCount: 'друзей'
		},
		clan: {
			title: 'Команды',
			subtitle: 'Присоединяйтесь к команде',
			howItWorks: 'Как это работает',
			howItWorksDesc: 'Тапайте с командой и получайте бонусы',
			joinTitle: 'Присоединиться',
			joinDesc: 'Введите юзернейм команды',
			joinBtn: 'Войти',
			popularSquads: 'Популярные команды',
			noSquads: 'Команды не найдены',
			members: 'участников',
			inviteText: 'Присоединяйся к моей команде {title}!'
		},
		tap: {
			noClan: 'Нет команды',
			joinClan: 'Вступить в команду'
		}
	},`,
  'zh.ts': `	airdropFinal: {
		friends: {
			title: '邀请朋友！',
			subtitle: '您和您的朋友都将获得奖励。',
			inviteBoxTitle: '邀请朋友',
			inviteBoxDesc: '+10,000 给你和你的朋友',
			premiumBoxTitle: '拥有Telegram高级版的朋友',
			premiumBoxDesc: '+100,000 给你和你的朋友',
			listTitle: '你的朋友列表',
			noFriends: '你还没有邀请任何人',
			inviteBtn: '邀请朋友',
			frensCount: '个朋友'
		},
		clan: {
			title: '团队',
			subtitle: '加入团队一起挖矿',
			howItWorks: '怎么运行的',
			howItWorksDesc: '与团队一起点击并获得奖金',
			joinTitle: '加入团队',
			joinDesc: '输入团队用户名加入',
			joinBtn: '加入',
			popularSquads: '热门团队',
			noSquads: '未找到团队',
			members: '成员',
			inviteText: '加入我的团队 {title}，我们一起赚钱！'
		},
		tap: {
			noClan: '没有团队',
			joinClan: '加入团队'
		}
	},`
};

for (const file of files) {
  const path = 'c:/Users/DEll/Desktop/iFragment/frontend/src/shared/i18n/' + file;
  let content = fs.readFileSync(path, 'utf8');
  if (!content.includes('airdropFinal: {')) {
    // Insert before the last export closing brace
    content = content.replace(/}(\\s*);\\s*$/, ',\\n' + blocks[file] + '\\n}$1;');
    fs.writeFileSync(path, content);
    console.log('Updated ' + file);
  } else {
    console.log(file + ' already has airdropFinal');
  }
}
