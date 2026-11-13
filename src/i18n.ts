// Languages. The player picks one on the title screen or in Settings (stored on this device, not in the save).
// The interface is written in English; this module swaps exact English UI strings (buttons, menus, settings,
// Zahra's tour) for the chosen language as they appear on screen, so every panel is covered without each one
// knowing about languages. Player content (names, chat, messages), the CV page and lesson text stay as written.
// English (US) also turns UK spellings into US ones. Arabic panels read right to left.
export type LangId = 'en-US' | 'en-GB' | 'ar' | 'zh' | 'es' | 'ha' | 'sw' | 'ja' | 'ko' | 'tr' | 'fr' | 'pt' | 'hi' | 'yo'
export const LANGS: Array<{ id: LangId; name: string; speech: string }> = [
  { id: 'en-US', name: 'English (US)', speech: 'en-US' },
  { id: 'en-GB', name: 'English (UK)', speech: 'en-GB' },
  { id: 'ar', name: 'العربية', speech: 'ar' },
  { id: 'zh', name: '中文', speech: 'zh-CN' },
  { id: 'es', name: 'Español', speech: 'es' },
  { id: 'ha', name: 'Hausa', speech: 'ha' },
  { id: 'sw', name: 'Kiswahili', speech: 'sw' },
  { id: 'ja', name: '日本語', speech: 'ja' },
  { id: 'ko', name: '한국어', speech: 'ko' },
  { id: 'tr', name: 'Türkçe', speech: 'tr' },
  { id: 'fr', name: 'Français', speech: 'fr' },
  { id: 'pt', name: 'Português', speech: 'pt-BR' },
  { id: 'hi', name: 'हिन्दी', speech: 'hi' },
  { id: 'yo', name: 'Yorùbá', speech: 'yo' },
]
const ORDER = ['ar', 'zh', 'es', 'ha', 'sw', 'ja', 'ko', 'tr', 'fr', 'pt', 'hi', 'yo'] as const
// English, then: Arabic, Chinese, Spanish, Hausa, Swahili, Japanese, Korean, Turkish, French, Portuguese, Hindi, Yoruba.
const ROWS: string[][] = [
  // Title screen and sign-in
  ['Sign up', 'إنشاء حساب', '注册', 'Registrarse', 'Yi rajista', 'Jisajili', '新規登録', '가입하기', 'Kaydol', "S'inscrire", 'Criar conta', 'साइन अप करें', 'Forúkọsílẹ̀'],
  ['Sign in', 'تسجيل الدخول', '登录', 'Iniciar sesión', 'Shiga', 'Ingia', 'ログイン', '로그인', 'Giriş yap', 'Se connecter', 'Entrar', 'साइन इन करें', 'Wọlé'],
  ['Agents', 'الوكلاء', '智能体', 'Agentes', 'Wakilai', 'Mawakala', 'エージェント', '에이전트', 'Ajanlar', 'Agents', 'Agentes', 'एजेंट', 'Àwọn aṣojú'],
  ['Continue', 'متابعة', '继续', 'Continuar', 'Ci gaba', 'Endelea', '続ける', '계속', 'Devam et', 'Continuer', 'Continuar', 'जारी रखें', 'Tẹ̀síwájú'],
  ['Back', 'رجوع', '返回', 'Atrás', 'Koma baya', 'Rudi', '戻る', '뒤로', 'Geri', 'Retour', 'Voltar', 'वापस', 'Padà'],
  ['‹ Back', '‹ رجوع', '‹ 返回', '‹ Atrás', '‹ Koma baya', '‹ Rudi', '‹ 戻る', '‹ 뒤로', '‹ Geri', '‹ Retour', '‹ Voltar', '‹ वापस', '‹ Padà'],
  ['Create account', 'إنشاء الحساب', '创建账户', 'Crear cuenta', 'Ƙirƙiri asusu', 'Fungua akaunti', 'アカウント作成', '계정 만들기', 'Hesap oluştur', 'Créer le compte', 'Criar conta', 'खाता बनाएँ', 'Ṣẹ̀dá àkáǹtì'],
  ['Enter the district', 'ادخل الحي', '进入城区', 'Entra al distrito', 'Shiga unguwar', 'Ingia mtaani', '街へ入る', '도시로 들어가기', 'Bölgeye gir', 'Entrer dans le quartier', 'Entrar no distrito', 'डिस्ट्रिक्ट में जाएँ', 'Wọ inú àdúgbò'],
  ['Choose your look', 'اختر مظهرك', '选择你的形象', 'Elige tu estilo', 'Zaɓi kamanninka', 'Chagua mwonekano wako', '見た目を選ぶ', '모습을 선택하세요', 'Görünümünü seç', 'Choisis ton style', 'Escolha seu visual', 'अपना लुक चुनें', 'Yan ìrísí rẹ'],
  ['City · career · skills · CV', 'مدينة · مهنة · مهارات · سيرة ذاتية', '城市 · 职业 · 技能 · 简历', 'Ciudad · carrera · habilidades · CV', 'Birni · sana’a · ƙwarewa · CV', 'Jiji · kazi · ujuzi · CV', '街・キャリア・スキル・履歴書', '도시 · 커리어 · 기술 · 이력서', 'Şehir · kariyer · beceriler · CV', 'Ville · carrière · compétences · CV', 'Cidade · carreira · habilidades · CV', 'शहर · करियर · कौशल · सीवी', 'Ìlú · iṣẹ́ · ọgbọ́n · CV'],
  ['Live a Web3 life. Build proof that travels with you.', 'عِش حياة Web3. وابنِ إثباتًا يرافقك أينما ذهبت.', '过一段 Web3 生活，积累随身携带的证明。', 'Vive una vida Web3. Construye pruebas que viajan contigo.', 'Yi rayuwar Web3. Gina shaidar da za ta bi ka ko’ina.', 'Ishi maisha ya Web3. Jenga ushahidi unaoenda nawe.', 'Web3 の暮らしを。どこへでも持っていける証明を。', 'Web3의 삶을 살아 보세요. 어디서나 통하는 증명을 쌓으세요.', 'Web3 hayatı yaşa. Seninle gelen kanıtlar biriktir.', 'Vis une vie Web3. Construis des preuves qui te suivent.', 'Viva uma vida Web3. Construa provas que vão com você.', 'Web3 जीवन जिएँ। ऐसा प्रमाण बनाएँ जो हर जगह साथ चले।', 'Gbé ayé Web3. Kọ́ ẹ̀rí tí yóò máa tẹ̀lé ọ.'],
  ['Lady', 'سيدة', '女士', 'Dama', 'Mace', 'Mwanamke', '女性', '여성', 'Hanım', 'Dame', 'Dama', 'महिला', 'Obìnrin'],
  ['Gentleman', 'رجل', '先生', 'Caballero', 'Namiji', 'Mwanaume', '男性', '남성', 'Beyefendi', 'Monsieur', 'Cavalheiro', 'पुरुष', 'Ọkùnrin'],
  ['Name', 'الاسم', '名字', 'Nombre', 'Suna', 'Jina', '名前', '이름', 'Ad', 'Nom', 'Nome', 'नाम', 'Orúkọ'],
  ['Continue with X', 'المتابعة عبر X', '使用 X 继续', 'Continuar con X', 'Ci gaba da X', 'Endelea na X', 'X で続ける', 'X로 계속', 'X ile devam et', 'Continuer avec X', 'Continuar com X', 'X के साथ जारी रखें', 'Tẹ̀síwájú pẹ̀lú X'],
  ['Continue with Google', 'المتابعة عبر Google', '使用 Google 继续', 'Continuar con Google', 'Ci gaba da Google', 'Endelea na Google', 'Google で続ける', 'Google로 계속', 'Google ile devam et', 'Continuer avec Google', 'Continuar com Google', 'Google के साथ जारी रखें', 'Tẹ̀síwájú pẹ̀lú Google'],
  ['Continue with NEAR', 'المتابعة عبر NEAR', '使用 NEAR 继续', 'Continuar con NEAR', 'Ci gaba da NEAR', 'Endelea na NEAR', 'NEAR で続ける', 'NEAR로 계속', 'NEAR ile devam et', 'Continuer avec NEAR', 'Continuar com NEAR', 'NEAR के साथ जारी रखें', 'Tẹ̀síwájú pẹ̀lú NEAR'],
  ['Email me a code', 'أرسل لي رمزًا', '给我发送验证码', 'Envíame un código', 'Aiko min lamba', 'Nitumie msimbo', 'コードをメールで送る', '코드 받기', 'Bana kod gönder', 'Envoie-moi un code', 'Envie-me um código', 'मुझे कोड भेजें', 'Fi kóòdù ránṣẹ́ sí mi'],
  // Menu and HUD
  ['Messages', 'الرسائل', '消息', 'Mensajes', 'Saƙonni', 'Ujumbe', 'メッセージ', '메시지', 'Mesajlar', 'Messages', 'Mensagens', 'संदेश', 'Àwọn ìfiránṣẹ́'],
  ['Notifications', 'الإشعارات', '通知', 'Notificaciones', 'Sanarwa', 'Arifa', '通知', '알림', 'Bildirimler', 'Notifications', 'Notificações', 'सूचनाएँ', 'Àwọn ìkéde'],
  ['Map', 'الخريطة', '地图', 'Mapa', 'Taswira', 'Ramani', 'マップ', '지도', 'Harita', 'Carte', 'Mapa', 'नक्शा', 'Máàpù'],
  ['Home', 'المنزل', '家', 'Casa', 'Gida', 'Nyumbani', '家', '집', 'Ev', 'Maison', 'Casa', 'घर', 'Ilé'],
  ['Profile', 'الملف الشخصي', '个人资料', 'Perfil', 'Bayanan kai', 'Wasifu', 'プロフィール', '프로필', 'Profil', 'Profil', 'Perfil', 'प्रोफ़ाइल', 'Profaili'],
  ['Boutique', 'المتجر', '精品店', 'Boutique', 'Shagon tufafi', 'Duka la mitindo', 'ブティック', '부티크', 'Butik', 'Boutique', 'Boutique', 'बुटीक', 'Ṣọ́ọ̀bù aṣọ'],
  ['Trade', 'التداول', '交易', 'Operar', 'Ciniki', 'Biashara', 'トレード', '거래', 'Al-sat', 'Trader', 'Negociar', 'ट्रेड', 'Ìṣòwò'],
  ['Career', 'المهنة', '职业', 'Carrera', 'Sana’a', 'Kazi', 'キャリア', '커리어', 'Kariyer', 'Carrière', 'Carreira', 'करियर', 'Iṣẹ́'],
  ['Settings', 'الإعدادات', '设置', 'Ajustes', 'Saituna', 'Mipangilio', '設定', '설정', 'Ayarlar', 'Réglages', 'Configurações', 'सेटिंग्स', 'Ètò'],
  ['Shortcuts', 'الاختصارات', '快捷键', 'Atajos', 'Gajerun hanyoyi', 'Njia za mkato', 'ショートカット', '단축키', 'Kısayollar', 'Raccourcis', 'Atalhos', 'शॉर्टकट', 'Ọ̀nà àbùjá'],
  ['Close', 'إغلاق', '关闭', 'Cerrar', 'Rufe', 'Funga', '閉じる', '닫기', 'Kapat', 'Fermer', 'Fechar', 'बंद करें', 'Pa á dé'],
  ['Next', 'التالي', '下一步', 'Siguiente', 'Na gaba', 'Inayofuata', '次へ', '다음', 'İleri', 'Suivant', 'Próximo', 'आगे', 'Èyí tó kàn'],
  ['Open', 'فتح', '打开', 'Abrir', 'Buɗe', 'Fungua', '開く', '열기', 'Aç', 'Ouvrir', 'Abrir', 'खोलें', 'Ṣí i'],
  ['Enter', 'دخول', '进入', 'Entrar', 'Shiga', 'Ingia', '入る', '들어가기', 'Gir', 'Entrer', 'Entrar', 'प्रवेश करें', 'Wọlé'],
  ['Go inside', 'ادخل', '进去', 'Entrar', 'Shiga ciki', 'Ingia ndani', '中に入る', '안으로 들어가기', 'İçeri gir', 'Entrer', 'Entrar', 'अंदर जाएँ', 'Wọlé'],
  ['Sit', 'اجلس', '坐下', 'Sentarse', 'Zauna', 'Keti', '座る', '앉기', 'Otur', "S'asseoir", 'Sentar', 'बैठें', 'Jókòó'],
  ['Stand', 'قف', '站起', 'Levantarse', 'Tashi', 'Simama', '立つ', '일어서기', 'Kalk', 'Se lever', 'Levantar', 'खड़े हों', 'Dìde'],
  ['Greet', 'تحية', '打招呼', 'Saludar', 'Gaisa', 'Salimia', 'あいさつ', '인사하기', 'Selamla', 'Saluer', 'Cumprimentar', 'अभिवादन', 'Kí'],
  ['Cancel', 'إلغاء', '取消', 'Cancelar', 'Soke', 'Ghairi', 'キャンセル', '취소', 'İptal', 'Annuler', 'Cancelar', 'रद्द करें', 'Fagilé'],
  ['Send', 'إرسال', '发送', 'Enviar', 'Aika', 'Tuma', '送信', '보내기', 'Gönder', 'Envoyer', 'Enviar', 'भेजें', 'Fi ránṣẹ́'],
  ['Nearby chat', 'دردشة قريبة', '附近聊天', 'Chat cercano', 'Hira da na kusa', 'Gumzo la karibu', '近くの人とチャット', '근처 채팅', 'Yakındaki sohbet', 'Discussion à proximité', 'Chat por perto', 'आस-पास चैट', 'Ìfọ̀rọ̀wérọ̀ nítòsí'],
  ['Search by username or name', 'ابحث باسم المستخدم أو الاسم', '按用户名或名字搜索', 'Busca por usuario o nombre', 'Nemo da sunan mai amfani ko suna', 'Tafuta kwa jina la mtumiaji au jina', 'ユーザー名または名前で検索', '사용자 이름 또는 이름으로 검색', 'Kullanıcı adı veya isimle ara', "Rechercher par pseudo ou nom", 'Buscar por usuário ou nome', 'यूज़रनेम या नाम से खोजें', 'Wá pẹ̀lú orúkọ olùmúlò tàbí orúkọ'],
  ['Talk to Zahra', 'تحدّث مع زهراء', '和扎赫拉聊聊', 'Hablar con Zahra', 'Yi magana da Zahra', 'Ongea na Zahra', 'ザフラと話す', '자흐라와 대화하기', 'Zahra ile konuş', 'Parler à Zahra', 'Falar com Zahra', 'ज़हरा से बात करें', 'Bá Zahra sọ̀rọ̀'],
  // Settings
  ['Language', 'اللغة', '语言', 'Idioma', 'Harshe', 'Lugha', '言語', '언어', 'Dil', 'Langue', 'Idioma', 'भाषा', 'Èdè'],
  ['Account', 'الحساب', '账户', 'Cuenta', 'Asusu', 'Akaunti', 'アカウント', '계정', 'Hesap', 'Compte', 'Conta', 'खाता', 'Àkáǹtì'],
  ['Support', 'الدعم', '支持', 'Soporte', 'Taimako', 'Msaada', 'サポート', '지원', 'Destek', 'Assistance', 'Suporte', 'सहायता', 'Ìrànlọ́wọ́'],
  ['Graphics', 'الرسومات', '画质', 'Gráficos', 'Hotuna', 'Michoro', 'グラフィック', '그래픽', 'Grafik', 'Graphismes', 'Gráficos', 'ग्राफ़िक्स', 'Àwòrán'],
  ['Theme', 'المظهر', '主题', 'Tema', 'Jigo', 'Mandhari', 'テーマ', '테마', 'Tema', 'Thème', 'Tema', 'थीम', 'Àwọ̀'],
  ['Sound', 'الصوت', '声音', 'Sonido', 'Sauti', 'Sauti', 'サウンド', '소리', 'Ses', 'Son', 'Som', 'ध्वनि', 'Ohùn'],
  ['Comfort', 'الراحة', '舒适', 'Comodidad', 'Jin daɗi', 'Starehe', '快適さ', '편안함', 'Konfor', 'Confort', 'Conforto', 'आराम', 'Ìtura'],
  ['Low', 'منخفض', '低', 'Bajo', 'Ƙasa', 'Chini', '低', '낮음', 'Düşük', 'Bas', 'Baixo', 'कम', 'Kéré'],
  ['Medium', 'متوسط', '中', 'Medio', 'Matsakaici', 'Wastani', '中', '중간', 'Orta', 'Moyen', 'Médio', 'मध्यम', 'Àárín'],
  ['High', 'مرتفع', '高', 'Alto', 'Sama', 'Juu', '高', '높음', 'Yüksek', 'Élevé', 'Alto', 'उच्च', 'Gíga'],
  ['Dark', 'داكن', '深色', 'Oscuro', 'Duhu', 'Giza', 'ダーク', '어둡게', 'Koyu', 'Sombre', 'Escuro', 'डार्क', 'Dúdú'],
  ['Light', 'فاتح', '浅色', 'Claro', 'Haske', 'Mwanga', 'ライト', '밝게', 'Açık', 'Clair', 'Claro', 'लाइट', 'Mọ́lẹ̀'],
  ['GM day', 'نهار', '白天', 'Día', 'Rana', 'Mchana', '昼', '낮', 'Gündüz', 'Jour', 'Dia', 'दिन', 'Ọ̀sán'],
  ['Dusk', 'الغروب', '黄昏', 'Atardecer', 'Magariba', 'Jioni', '夕暮れ', '해질녘', 'Akşam', 'Crépuscule', 'Entardecer', 'शाम', 'Ìrọ̀lẹ́'],
  ['GN night', 'ليل', '夜晚', 'Noche', 'Dare', 'Usiku', '夜', '밤', 'Gece', 'Nuit', 'Noite', 'रात', 'Alẹ́'],
  ['Auto', 'تلقائي', '自动', 'Auto', 'Kai tsaye', 'Otomatiki', '自動', '자동', 'Otomatik', 'Auto', 'Auto', 'स्वतः', 'Aládàáṣe'],
  ['Voices on', 'الأصوات مفعّلة', '语音开', 'Voces activadas', 'Muryoyi a kunne', 'Sauti za watu zimewashwa', '音声オン', '음성 켜짐', 'Sesler açık', 'Voix activées', 'Vozes ligadas', 'आवाज़ें चालू', 'Ohùn wà ní títàn'],
  ['Voices off', 'الأصوات متوقفة', '语音关', 'Voces desactivadas', 'Muryoyi a kashe', 'Sauti za watu zimezimwa', '音声オフ', '음성 꺼짐', 'Sesler kapalı', 'Voix désactivées', 'Vozes desligadas', 'आवाज़ें बंद', 'Ohùn wà ní pípa'],
  ['Music on', 'الموسيقى مفعّلة', '音乐开', 'Música activada', 'Kiɗa a kunne', 'Muziki umewashwa', '音楽オン', '음악 켜짐', 'Müzik açık', 'Musique activée', 'Música ligada', 'संगीत चालू', 'Orin wà ní títàn'],
  ['Music off', 'الموسيقى متوقفة', '音乐关', 'Música desactivada', 'Kiɗa a kashe', 'Muziki umezimwa', '音楽オフ', '음악 꺼짐', 'Müzik kapalı', 'Musique désactivée', 'Música desligada', 'संगीत बंद', 'Orin wà ní pípa'],
  ['City sound on', 'أصوات المدينة مفعّلة', '城市声音开', 'Sonido de ciudad activado', 'Sautin birni a kunne', 'Sauti ya jiji imewashwa', '街の音オン', '도시 소리 켜짐', 'Şehir sesi açık', 'Bruits de la ville activés', 'Som da cidade ligado', 'शहर की आवाज़ चालू', 'Ariwo ìlú wà ní títàn'],
  ['City sound off', 'أصوات المدينة متوقفة', '城市声音关', 'Sonido de ciudad desactivado', 'Sautin birni a kashe', 'Sauti ya jiji imezimwa', '街の音オフ', '도시 소리 꺼짐', 'Şehir sesi kapalı', 'Bruits de la ville désactivés', 'Som da cidade desligado', 'शहर की आवाज़ बंद', 'Ariwo ìlú wà ní pípa'],
  ['Notifications on', 'الإشعارات مفعّلة', '通知开', 'Notificaciones activadas', 'Sanarwa a kunne', 'Arifa zimewashwa', '通知オン', '알림 켜짐', 'Bildirimler açık', 'Notifications activées', 'Notificações ligadas', 'सूचनाएँ चालू', 'Àwọn ìkéde wà ní títàn'],
  ['Notifications off', 'الإشعارات متوقفة', '通知关', 'Notificaciones desactivadas', 'Sanarwa a kashe', 'Arifa zimezimwa', '通知オフ', '알림 꺼짐', 'Bildirimler kapalı', 'Notifications désactivées', 'Notificações desligadas', 'सूचनाएँ बंद', 'Àwọn ìkéde wà ní pípa'],
  ['Sign out', 'تسجيل الخروج', '退出登录', 'Cerrar sesión', 'Fita', 'Toka', 'ログアウト', '로그아웃', 'Çıkış yap', 'Se déconnecter', 'Sair', 'साइन आउट', 'Jáde'],
  ['Remove / change email…', 'إزالة / تغيير البريد…', '移除/更改邮箱…', 'Quitar / cambiar correo…', 'Cire / canza imel…', 'Ondoa / badilisha barua pepe…', 'メールを削除・変更…', '이메일 삭제/변경…', 'E-postayı kaldır / değiştir…', 'Retirer / changer l’e-mail…', 'Remover / alterar e-mail…', 'ईमेल हटाएँ / बदलें…', 'Yọ / yí ímeèlì padà…'],
  ['Delete my account / data…', 'حذف حسابي / بياناتي…', '删除我的账户/数据…', 'Eliminar mi cuenta / datos…', 'Goge asusuna / bayanai…', 'Futa akaunti / data yangu…', 'アカウント・データを削除…', '계정/데이터 삭제…', 'Hesabımı / verilerimi sil…', 'Supprimer mon compte / mes données…', 'Excluir minha conta / dados…', 'मेरा खाता / डेटा हटाएँ…', 'Pa àkáǹtì / dátà mi rẹ́…'],
  ['Reset game progress…', 'إعادة ضبط تقدّم اللعبة…', '重置游戏进度…', 'Reiniciar progreso…', 'Sake saita ci gaban wasa…', 'Weka upya maendeleo ya mchezo…', '進行状況をリセット…', '게임 진행 초기화…', 'Oyun ilerlemesini sıfırla…', 'Réinitialiser la progression…', 'Redefinir progresso…', 'गेम प्रगति रीसेट करें…', 'Tún ìlọsíwájú eré ṣe…'],
  ['Suggestions & feedback', 'اقتراحات وملاحظات', '建议与反馈', 'Sugerencias y comentarios', 'Shawarwari da ra’ayoyi', 'Mapendekezo na maoni', 'ご意見・ご要望', '제안 및 피드백', 'Öneriler ve geri bildirim', 'Suggestions et avis', 'Sugestões e feedback', 'सुझाव और प्रतिक्रिया', 'Àbá àti èsì'],
  ['About this city', 'عن هذه المدينة', '关于这座城市', 'Sobre esta ciudad', 'Game da wannan birni', 'Kuhusu jiji hili', 'この街について', '이 도시에 대해', 'Bu şehir hakkında', 'À propos de cette ville', 'Sobre esta cidade', 'इस शहर के बारे में', 'Nípa ìlú yìí'],
  ['Tour with Zahra', 'جولة مع زهراء', '跟扎赫拉逛逛', 'Recorrido con Zahra', 'Rangadi tare da Zahra', 'Ziara na Zahra', 'ザフラと街めぐり', '자흐라와 둘러보기', 'Zahra ile tur', 'Visite avec Zahra', 'Tour com Zahra', 'ज़हरा के साथ टूर', 'Ìrìn àjò pẹ̀lú Zahra'],
  // Profile
  ['CV', 'السيرة الذاتية', '简历', 'CV', 'CV', 'CV', '履歴書', '이력서', 'CV', 'CV', 'Currículo', 'सीवी', 'CV'],
  ['Certificates', 'الشهادات', '证书', 'Certificados', 'Takardun shaida', 'Vyeti', '修了証', '수료증', 'Sertifikalar', 'Certificats', 'Certificados', 'प्रमाणपत्र', 'Ìwé ẹ̀rí'],
  ['Books', 'الدفاتر', '账本', 'Libros', 'Littattafan kuɗi', 'Vitabu vya hesabu', '帳簿', '장부', 'Defterler', 'Comptes', 'Livros', 'बहीखाते', 'Ìwé owó'],
  ['Download PDF', 'تنزيل PDF', '下载 PDF', 'Descargar PDF', 'Sauke PDF', 'Pakua PDF', 'PDF をダウンロード', 'PDF 다운로드', 'PDF indir', 'Télécharger le PDF', 'Baixar PDF', 'PDF डाउनलोड करें', 'Ṣe ìgbàsílẹ̀ PDF'],
  ['Share my CV page', 'شارك صفحة سيرتي', '分享我的简历页面', 'Compartir mi CV', 'Raba shafin CV na', 'Shiriki ukurasa wa CV yangu', '履歴書ページを共有', '내 이력서 페이지 공유', 'CV sayfamı paylaş', 'Partager ma page CV', 'Compartilhar meu currículo', 'मेरा सीवी पेज साझा करें', 'Pín ojú-ìwé CV mi'],
  ['Copy invite link', 'نسخ رابط الدعوة', '复制邀请链接', 'Copiar enlace de invitación', 'Kwafi hanyar gayyata', 'Nakili kiungo cha mwaliko', '招待リンクをコピー', '초대 링크 복사', 'Davet bağlantısını kopyala', "Copier le lien d'invitation", 'Copiar link de convite', 'आमंत्रण लिंक कॉपी करें', 'Da ìjápọ̀ ìpè kọ'],
  ['Open courses', 'افتح الدورات', '打开课程', 'Abrir cursos', 'Buɗe darussa', 'Fungua kozi', '講座を開く', '강좌 열기', 'Kursları aç', 'Ouvrir les cours', 'Abrir cursos', 'कोर्स खोलें', 'Ṣí àwọn ẹ̀kọ́'],
  // Trading
  ['Spot', 'فوري', '现货', 'Spot', 'Nan take', 'Papo hapo', '現物', '현물', 'Spot', 'Spot', 'Spot', 'स्पॉट', 'Lẹ́sẹ̀kẹsẹ̀'],
  ['Perps', 'عقود دائمة', '永续合约', 'Perpetuos', 'Kwangiloli', 'Mikataba ya kudumu', '無期限先物', '무기한 선물', 'Vadeli', 'Perpétuels', 'Perpétuos', 'पर्प्स', 'Àdéhùn àìnípẹ̀kun'],
  ['Convert', 'تحويل', '兑换', 'Convertir', 'Canja', 'Badilisha', '両替', '전환', 'Dönüştür', 'Convertir', 'Converter', 'बदलें', 'Pàṣípààrọ̀'],
  ['Buy', 'شراء', '买入', 'Comprar', 'Saya', 'Nunua', '買う', '매수', 'Al', 'Acheter', 'Comprar', 'खरीदें', 'Rà'],
  ['Sell', 'بيع', '卖出', 'Vender', 'Sayar', 'Uza', '売る', '매도', 'Sat', 'Vendre', 'Vender', 'बेचें', 'Tà'],
  ['Long', 'شراء (Long)', '做多', 'Largo', 'Long', 'Long', 'ロング', '롱', 'Long', 'Long', 'Long', 'लॉन्ग', 'Long'],
  ['Short', 'بيع (Short)', '做空', 'Corto', 'Short', 'Short', 'ショート', '숏', 'Short', 'Short', 'Short', 'शॉर्ट', 'Short'],
  ['Coins', 'العملات', '币', 'Monedas', 'Tsabobi', 'Sarafu', 'コイン', '코인', 'Coinler', 'Pièces', 'Moedas', 'कॉइन', 'Owó ẹyọ'],
  ['Tokens', 'الرموز', '代币', 'Tokens', 'Alamu', 'Tokeni', 'トークン', '토큰', 'Tokenler', 'Jetons', 'Tokens', 'टोकन', 'Àmì'],
  ['⏸ Pause voice', '⏸ إيقاف الصوت', '⏸暂停语音', '⏸ Pausar voz', '⏸ Dakatar da murya', '⏸ Simamisha sauti', '⏸ 音声を一時停止', '⏸ 음성 일시정지', '⏸ Sesi duraklat', '⏸ Mettre la voix en pause', '⏸ Pausar voz', '⏸ आवाज़ रोकें', '⏸ Dá ohùn dúró'],
  ['▶ Play voice', '▶ تشغيل الصوت', '▶ 播放语音', '▶ Reproducir voz', '▶ Kunna murya', '▶ Cheza sauti', '▶ 音声を再生', '▶ 음성 재생', '▶ Sesi oynat', '▶ Lire la voix', '▶ Tocar voz', '▶ आवाज़ चलाएँ', '▶ Tan ohùn'],
  ['← Your path', '← مسارك', '← 你的路线', '← Tu camino', '← Hanyarka', '← Njia yako', '← あなたの道', '← 나의 길', '← Yolun', '← Ton parcours', '← Seu caminho', '← आपका रास्ता', '← Ọ̀nà rẹ'],
  ['Skip to the quick check', 'انتقل إلى الاختبار السريع', '跳到小测验', 'Ir a la prueba rápida', 'Tsallaka zuwa ɗan gwaji', 'Ruka hadi jaribio fupi', 'クイックチェックへ', '빠른 확인으로 건너뛰기', 'Hızlı teste geç', 'Passer au petit test', 'Pular para o teste rápido', 'सीधे क्विक चेक पर जाएँ', 'Fò lọ sí ìdánwò kékeré'],
  ['Username', 'اسم المستخدم', '用户名', 'Usuario', 'Sunan mai amfani', 'Jina la mtumiaji', 'ユーザー名', '사용자 이름', 'Kullanıcı adı', "Nom d'utilisateur", 'Usuário', 'यूज़रनेम', 'Orúkọ olùmúlò'],
  ['GN time', 'وقت الليل', '时间', 'Hora del día', 'Lokaci', 'Wakati', '時間帯', '시간대', 'Saat', "Moment de la journée", 'Hora do dia', 'समय', 'Àkókò'],
  ['Choose your GN time. The city stays open in all three.', 'اختر الوقت. المدينة مفتوحة في الأوقات الثلاثة.', '选择时间。三个时段城市都开放。', 'Elige la hora. La ciudad sigue abierta en las tres.', 'Zaɓi lokaci. Birnin a buɗe yake a duka ukun.', 'Chagua wakati. Jiji liko wazi katika zote tatu.', '時間帯を選んでください。どの時間も街は開いています。', '시간대를 고르세요. 세 시간대 모두 도시는 열려 있어요.', 'Saati seç. Şehir üçünde de açık.', 'Choisis le moment. La ville reste ouverte dans les trois.', 'Escolha a hora. A cidade fica aberta nas três.', 'समय चुनें। तीनों में शहर खुला रहता है।', 'Yan àkókò. Ìlú wà ní ṣíṣí ní gbogbo mẹ́ta.'],
  ['Dark or light panels, menu and buttons. The city keeps its own time of day.', 'لوحات وقائمة وأزرار داكنة أو فاتحة. تحتفظ المدينة بوقتها من اليوم.', '面板、菜单和按钮用深色或浅色。城市保留自己的时间。', 'Paneles, menú y botones oscuros o claros. La ciudad mantiene su hora del día.', 'Faifai, menu da maɓallai masu duhu ko haske. Birnin yana riƙe lokacinsa.', 'Paneli, menyu na vitufe vya giza au mwanga. Jiji linabaki na wakati wake.', 'パネル・メニュー・ボタンを暗く/明るく。街の時間帯はそのままです。', '패널, 메뉴, 버튼을 어둡게 또는 밝게. 도시는 자기 시간대를 유지해요.', 'Koyu ya da açık paneller, menü ve düğmeler. Şehir kendi saatini korur.', "Panneaux, menu et boutons sombres ou clairs. La ville garde son heure.", 'Painéis, menu e botões escuros ou claros. A cidade mantém sua hora do dia.', 'गहरे या हल्के पैनल, मेन्यू और बटन। शहर अपना समय रखता है।', 'Pánẹ́ẹ̀lì, àkójọ àti bọ́tìnnì dúdú tàbí mọ́lẹ̀. Ìlú ń pa àkókò tirẹ̀ mọ́.'],
  // Zahra
  ["I'm new", 'أنا جديد', '我是新手', 'Soy nuevo', 'Sabon shiga ne ni', 'Mimi ni mgeni', '初心者です', '처음이에요', 'Yeniyim', 'Je débute', 'Sou novo', 'मैं नया हूँ', 'Ẹni tuntun ni mí'],
  ['Test me (3 questions)', 'اختبرني (3 أسئلة)', '测一测（3 题）', 'Ponme a prueba (3 preguntas)', 'Gwada ni (tambayoyi 3)', 'Nijaribu (maswali 3)', 'テストして（3問）', '테스트하기 (3문제)', 'Beni test et (3 soru)', 'Teste-moi (3 questions)', 'Me teste (3 perguntas)', 'मेरी परीक्षा लें (3 प्रश्न)', 'Dán mi wò (ìbéèrè 3)'],
  ['Show me around', 'خذني في جولة', '带我逛逛', 'Muéstrame el lugar', 'Nuna min wurin', 'Nionyeshe mazingira', '案内して', '둘러보기', 'Bana etrafı göster', 'Fais-moi visiter', 'Me mostre o lugar', 'मुझे घुमाइए', 'Fi àyíká hàn mí'],
  ['Start my lesson', 'ابدأ درسي', '开始我的课程', 'Empezar mi lección', 'Fara darasina', 'Anza somo langu', 'レッスンを始める', '수업 시작하기', 'Dersime başla', 'Commencer ma leçon', 'Começar minha lição', 'मेरा पाठ शुरू करें', 'Bẹ̀rẹ̀ ẹ̀kọ́ mi'],
  ['What next?', 'ماذا بعد؟', '接下来做什么？', '¿Y ahora qué?', 'Me ya biyo?', 'Nini kinafuata?', '次は何？', '다음은?', 'Sırada ne var?', 'Et ensuite ?', 'E agora?', 'आगे क्या?', 'Kí ló kàn?'],
  ['Explore first', 'استكشف أولًا', '先逛逛', 'Explorar primero', 'Zan fara yawo', 'Nitazunguka kwanza', 'まず探検する', '먼저 둘러보기', 'Önce keşfet', "J'explore d'abord", 'Explorar primeiro', 'पहले घूमूँगा', 'Màá kọ́kọ́ ṣàwárí'],
  ['Take me to Campus', 'خذني إلى الحرم الجامعي', '带我去校园', 'Llévame al campus', 'Kai ni Campus', 'Nipeleke Campus', 'キャンパスへ連れて行って', '캠퍼스로 데려가 줘', 'Beni kampüse götür', "Emmène-moi au campus", 'Me leve ao campus', 'मुझे कैंपस ले चलें', 'Mú mi lọ sí Campus'],
  ['Skip tour', 'تخطي الجولة', '跳过导览', 'Saltar recorrido', 'Tsallake rangadi', 'Ruka ziara', 'ツアーをスキップ', '투어 건너뛰기', 'Turu atla', 'Passer la visite', 'Pular tour', 'टूर छोड़ें', 'Fò ìrìn àjò'],
  ['Campus guide', 'مرشدة الحرم', '校园向导', 'Guía del campus', 'Jagorar Campus', 'Kiongozi wa Campus', 'キャンパス案内', '캠퍼스 가이드', 'Kampüs rehberi', 'Guide du campus', 'Guia do campus', 'कैंपस गाइड', 'Atọ́nà Campus'],
  ['Campus mentor', 'مرشدة الحرم', '校园导师', 'Mentora del campus', 'Malamar Campus', 'Mshauri wa Campus', 'キャンパスのメンター', '캠퍼스 멘토', 'Kampüs mentoru', 'Mentore du campus', 'Mentora do campus', 'कैंपस मेंटर', 'Olùtọ́ Campus'],
  ['Welcome to Grind District! I’m Zahra. Give me one minute and I’ll show you around.', 'مرحبًا بك في Grind District! أنا زهراء. امنحني دقيقة واحدة وسأريك المكان.', '欢迎来到 Grind District！我是扎赫拉。给我一分钟，我带你四处看看。', '¡Bienvenido a Grind District! Soy Zahra. Dame un minuto y te enseño todo.', 'Barka da zuwa Grind District! Ni ce Zahra. Ba ni minti ɗaya in nuna maka wurin.', 'Karibu Grind District! Mimi ni Zahra. Nipe dakika moja nikuonyeshe mazingira.', 'Grind District へようこそ！ザフラです。1分だけください、案内しますね。', 'Grind District에 오신 걸 환영해요! 저는 자흐라예요. 1분만 주시면 안내해 드릴게요.', "Grind District'e hoş geldin! Ben Zahra. Bana bir dakika ver, sana etrafı göstereyim.", 'Bienvenue à Grind District ! Je suis Zahra. Donne-moi une minute et je te fais visiter.', 'Bem-vindo ao Grind District! Eu sou a Zahra. Me dê um minuto e eu te mostro tudo.', 'Grind District में आपका स्वागत है! मैं ज़हरा हूँ। मुझे एक मिनट दीजिए, मैं आपको सब दिखाती हूँ।', 'Ẹ káàbọ̀ sí Grind District! Èmi ni Zahra. Fún mi ní ìṣẹ́jú kan, màá fi àyíká hàn ọ́.'],
  ['Web3 is the internet where you can own things yourself: money, art, even your certificates. Here you learn it by living it, with practice money only.', 'Web3 هو الإنترنت الذي يمكنك فيه امتلاك الأشياء بنفسك: المال والفن وحتى شهاداتك. هنا تتعلمه بأن تعيشه، وبأموال تدريبية فقط.', 'Web3 是你能自己拥有东西的互联网：钱、艺术，甚至你的证书。在这里你通过生活来学习它，只用练习资金。', 'Web3 es el internet donde puedes ser dueño de las cosas: dinero, arte, incluso tus certificados. Aquí lo aprendes viviéndolo, solo con dinero de práctica.', 'Web3 shi ne intanet inda kai da kanka za ka mallaki abubuwa: kuɗi, zane, har da takardun shaidarka. A nan za ka koye shi ta hanyar rayuwa da shi, da kuɗin gwaji kawai.', 'Web3 ni intaneti ambapo unaweza kumiliki vitu wewe mwenyewe: pesa, sanaa, hata vyeti vyako. Hapa unajifunza kwa kuishi, kwa pesa za mazoezi tu.', 'Web3 は、お金やアート、修了証まで自分で持てるインターネットです。ここでは練習用のお金だけで、暮らしながら学べます。', 'Web3는 돈, 예술, 수료증까지 직접 소유할 수 있는 인터넷이에요. 여기서는 연습용 돈으로 살아 보면서 배워요.', 'Web3, para, sanat, hatta sertifikalarına kendin sahip olabildiğin internettir. Burada onu yaşayarak, sadece alıştırma parasıyla öğrenirsin.', "Le Web3, c'est l'internet où tu possèdes les choses toi-même : argent, art, même tes certificats. Ici, tu l'apprends en le vivant, avec de l'argent d'entraînement uniquement.", 'Web3 é a internet onde você mesmo pode ser dono das coisas: dinheiro, arte, até seus certificados. Aqui você aprende vivendo, só com dinheiro de treino.', 'Web3 वह इंटरनेट है जहाँ आप खुद चीज़ों के मालिक हो सकते हैं: पैसा, कला, यहाँ तक कि आपके प्रमाणपत्र भी। यहाँ आप इसे जीकर सीखते हैं, सिर्फ़ अभ्यास वाले पैसों से।', 'Web3 ni íntánẹ́ẹ̀tì níbi tí o ti lè ní nǹkan fúnra rẹ: owó, iṣẹ́ ọnà, àti àwọn ìwé ẹ̀rí rẹ pàápàá. Níbí, o máa kọ́ ọ nípa gbígbé e, pẹ̀lú owó ìdánrawò nìkan.'],
  ['Move with the joystick at the bottom left, or W A S D on a computer. Drag the screen to look around.', 'تحرّك بعصا التحكم أسفل اليسار، أو بالمفاتيح W A S D على الحاسوب. اسحب الشاشة لتنظر حولك.', '用左下角的摇杆移动，电脑上用 W A S D。拖动屏幕环顾四周。', 'Muévete con el joystick abajo a la izquierda, o con W A S D en el ordenador. Arrastra la pantalla para mirar alrededor.', 'Matsa da sandar sarrafawa a ƙasan hagu, ko W A S D a kwamfuta. Ja allon don duba kewaye.', 'Tembea kwa kijiti cha kudhibiti chini kushoto, au W A S D kwenye kompyuta. Buruta skrini kuangalia pande zote.', '左下のジョイスティックで移動、パソコンなら W A S D。画面をドラッグして見回せます。', '왼쪽 아래 조이스틱으로 움직이고, 컴퓨터에서는 W A S D를 써요. 화면을 끌어서 둘러보세요.', 'Sol alttaki joystick ile, bilgisayarda W A S D ile hareket et. Etrafa bakmak için ekranı sürükle.', "Déplace-toi avec le joystick en bas à gauche, ou W A S D sur ordinateur. Fais glisser l'écran pour regarder autour.", 'Ande com o joystick no canto inferior esquerdo, ou W A S D no computador. Arraste a tela para olhar em volta.', 'नीचे बाईं ओर जॉयस्टिक से चलें, या कंप्यूटर पर W A S D से। चारों ओर देखने के लिए स्क्रीन खींचें।', 'Rìn pẹ̀lú joystick ní ìsàlẹ̀ apá òsì, tàbí W A S D lórí kọ̀ǹpútà. Fa ojú-ìbojú láti wo àyíká.'],
  ['Everything lives in the menu: your profile and CV, Trade, Career, the Boutique, the map and Messages.', 'كل شيء في القائمة: ملفك وسيرتك الذاتية، التداول، المهنة، المتجر، الخريطة والرسائل.', '所有东西都在菜单里：个人资料和简历、交易、职业、精品店、地图和消息。', 'Todo está en el menú: tu perfil y CV, Operar, Carrera, la Boutique, el mapa y los Mensajes.', 'Komai yana cikin menu: bayananka da CV, Ciniki, Sana’a, Shagon tufafi, taswira da Saƙonni.', 'Kila kitu kiko kwenye menyu: wasifu na CV yako, Biashara, Kazi, Duka la mitindo, ramani na Ujumbe.', 'メニューに全部あります：プロフィールと履歴書、トレード、キャリア、ブティック、マップ、メッセージ。', '모든 건 메뉴에 있어요: 프로필과 이력서, 거래, 커리어, 부티크, 지도, 메시지.', 'Her şey menüde: profilin ve CV’n, Al-sat, Kariyer, Butik, harita ve Mesajlar.', 'Tout est dans le menu : ton profil et ton CV, Trader, Carrière, la Boutique, la carte et les Messages.', 'Tudo fica no menu: seu perfil e currículo, Negociar, Carreira, a Boutique, o mapa e as Mensagens.', 'सब कुछ मेन्यू में है: आपकी प्रोफ़ाइल और सीवी, ट्रेड, करियर, बुटीक, नक्शा और संदेश।', 'Ohun gbogbo wà nínú àkójọ: profaili àti CV rẹ, Ìṣòwò, Iṣẹ́, Ṣọ́ọ̀bù aṣọ, máàpù àti Àwọn ìfiránṣẹ́.'],
  ['At Campus, short courses teach you Web3. Every course you pass goes on your CV with a certificate, and you can mint it as an NFT on NEAR.', 'في الحرم الجامعي، تعلّمك دورات قصيرة عالم Web3. كل دورة تجتازها تُضاف إلى سيرتك مع شهادة، ويمكنك سكّها كرمز NFT على NEAR.', '在校园里，短课程教你 Web3。你通过的每门课都会带着证书写进简历，还能在 NEAR 上铸造成 NFT。', 'En el Campus, cursos cortos te enseñan Web3. Cada curso que apruebas va a tu CV con un certificado, y puedes acuñarlo como NFT en NEAR.', 'A Campus, gajerun darussa za su koya maka Web3. Kowane darasi da ka ci yana shiga CV ɗinka da takardar shaida, kuma za ka iya buga shi a matsayin NFT a NEAR.', 'Kwenye Campus, kozi fupi zinakufundisha Web3. Kila kozi unayofaulu inaingia kwenye CV yako na cheti, na unaweza kuitengeneza kama NFT kwenye NEAR.', 'キャンパスでは短い講座で Web3 を学べます。合格した講座は修了証つきで履歴書に載り、NEAR で NFT として発行もできます。', '캠퍼스에서는 짧은 강좌로 Web3를 배워요. 통과한 강좌는 수료증과 함께 이력서에 올라가고, NEAR에서 NFT로 발행할 수도 있어요.', 'Kampüste kısa kurslar sana Web3’ü öğretir. Geçtiğin her kurs sertifikasıyla CV’ne eklenir ve onu NEAR’da NFT olarak basabilirsin.', "Au Campus, de courts cours t'apprennent le Web3. Chaque cours réussi va sur ton CV avec un certificat, et tu peux le frapper en NFT sur NEAR.", 'No Campus, cursos curtos ensinam Web3. Cada curso que você passa vai para o seu currículo com um certificado, e você pode cunhá-lo como NFT na NEAR.', 'कैंपस में छोटे कोर्स आपको Web3 सिखाते हैं। हर पास किया कोर्स प्रमाणपत्र के साथ आपके सीवी में जाता है, और आप उसे NEAR पर NFT के रूप में मिंट कर सकते हैं।', 'Ní Campus, àwọn ẹ̀kọ́ kúkúrú máa kọ́ ọ ní Web3. Gbogbo ẹ̀kọ́ tí o bá yege máa wọ inú CV rẹ pẹ̀lú ìwé ẹ̀rí, o sì lè ṣe é ní NFT lórí NEAR.'],
  ['Take a job in Career and do its task once a day to earn in-game money. Spend it on clothes, a car or a bigger home.', 'اختر وظيفة في المهنة وأنجز مهمتها مرة يوميًا لتكسب مالًا داخل اللعبة. أنفقه على الملابس أو سيارة أو منزل أكبر.', '在职业里找份工作，每天完成一次任务来赚游戏币。用它买衣服、车或更大的房子。', 'Consigue un trabajo en Carrera y haz su tarea una vez al día para ganar dinero del juego. Gástalo en ropa, un coche o una casa más grande.', 'Ɗauki aiki a Sana’a ka yi aikinsa sau ɗaya a rana don samun kuɗin wasa. Kashe su a tufafi, mota ko gida mafi girma.', 'Chukua kazi kwenye Kazi na ufanye kazi yake mara moja kwa siku kupata pesa za mchezo. Zitumie kwa nguo, gari au nyumba kubwa zaidi.', 'キャリアで仕事に就き、1日1回タスクをこなしてゲーム内のお金を稼ぎましょう。服や車、もっと大きな家に使えます。', '커리어에서 일자리를 얻고 하루에 한 번 업무를 하면 게임 머니를 벌어요. 옷, 자동차, 더 큰 집에 쓸 수 있어요.', 'Kariyer’de bir iş al ve oyun içi para kazanmak için görevini günde bir kez yap. Onu kıyafete, arabaya ya da daha büyük bir eve harca.', "Prends un emploi dans Carrière et fais sa tâche une fois par jour pour gagner de l'argent du jeu. Dépense-le en vêtements, en voiture ou en plus grande maison.", 'Arrume um emprego em Carreira e faça a tarefa uma vez por dia para ganhar dinheiro do jogo. Gaste com roupas, um carro ou uma casa maior.', 'करियर में नौकरी लें और गेम का पैसा कमाने के लिए रोज़ एक बार उसका काम करें। उसे कपड़ों, कार या बड़े घर पर ख़र्च करें।', 'Gba iṣẹ́ nínú Iṣẹ́, kí o sì ṣe iṣẹ́ rẹ̀ lẹ́ẹ̀kan lójúmọ́ láti rí owó eré. Ná a sórí aṣọ, mọ́tò tàbí ilé tó tóbi.'],
  ['Practise Spot, Perps, Convert and P2P on the trading floor. Prices move like the real market, but it is practice money.', 'تدرّب على التداول الفوري والعقود الدائمة والتحويل وP2P في قاعة التداول. الأسعار تتحرك مثل السوق الحقيقي، لكنها أموال تدريبية.', '在交易大厅练习现货、永续、兑换和 P2P。价格像真实市场一样波动，但用的是练习资金。', 'Practica Spot, Perpetuos, Convertir y P2P en el parqué. Los precios se mueven como en el mercado real, pero es dinero de práctica.', 'Yi gwajin Nan take, Kwangiloli, Canja da P2P a zauren ciniki. Farashi na motsi kamar kasuwa ta gaske, amma kuɗin gwaji ne.', 'Fanya mazoezi ya Papo hapo, Mikataba ya kudumu, Badilisha na P2P kwenye ukumbi wa biashara. Bei zinasonga kama soko halisi, lakini ni pesa za mazoezi.', 'トレーディングフロアで現物、無期限先物、両替、P2P を練習しましょう。値動きは本物の市場のようですが、お金は練習用です。', '트레이딩 플로어에서 현물, 무기한 선물, 전환, P2P를 연습해요. 가격은 실제 시장처럼 움직이지만 연습용 돈이에요.', 'İşlem salonunda Spot, Vadeli, Dönüştür ve P2P alıştırması yap. Fiyatlar gerçek piyasa gibi hareket eder ama para alıştırma parasıdır.', "Entraîne-toi au Spot, aux Perpétuels, à Convertir et au P2P sur le parquet. Les prix bougent comme le vrai marché, mais c'est de l'argent d'entraînement.", 'Pratique Spot, Perpétuos, Converter e P2P no pregão. Os preços se movem como no mercado real, mas é dinheiro de treino.', 'ट्रेडिंग फ़्लोर पर स्पॉट, पर्प्स, कन्वर्ट और P2P का अभ्यास करें। कीमतें असली बाज़ार की तरह चलती हैं, पर पैसा अभ्यास का है।', 'Ṣe ìdánrawò Lẹ́sẹ̀kẹsẹ̀, Àdéhùn àìnípẹ̀kun, Pàṣípààrọ̀ àti P2P ní gbọ̀ngàn ìṣòwò. Iye owó ń yí bí ọjà gidi, ṣùgbọ́n owó ìdánrawò ni.'],
  ['One rule above all: never share your seed phrase. Not with me, not with anyone.', 'قاعدة واحدة قبل كل شيء: لا تشارك عبارة الاسترداد أبدًا. لا معي ولا مع أي أحد.', '最重要的一条：永远不要分享你的助记词。不给我，也不给任何人。', 'Una regla por encima de todo: nunca compartas tu frase semilla. Ni conmigo, ni con nadie.', 'Doka ɗaya fiye da komai: kada ka taɓa raba kalmomin sirrin walat ɗinka. Ba da ni ba, ba da kowa ba.', 'Sheria moja juu ya zote: usishiriki kamwe maneno yako ya siri ya pochi. Si kwangu, si kwa mtu yeyote.', '何よりも大事なルール：シードフレーズは絶対に誰にも教えないで。私にも、誰にも。', '가장 중요한 규칙: 시드 문구는 절대 공유하지 마세요. 저에게도, 누구에게도요.', 'Her şeyden önemli bir kural: kurtarma ifadeni asla paylaşma. Ne benimle, ne de başkasıyla.', 'Une règle avant tout : ne partage jamais ta phrase secrète. Ni avec moi, ni avec personne.', 'Uma regra acima de tudo: nunca compartilhe sua frase-semente. Nem comigo, nem com ninguém.', 'सबसे बड़ा नियम: अपना सीड फ़्रेज़ कभी साझा न करें। न मुझसे, न किसी और से।', 'Òfin kan ju gbogbo rẹ̀ lọ: má ṣe pín gbólóhùn àṣírí àpamọ́wọ́ rẹ láé. Kì í ṣe pẹ̀lú mi, kì í ṣe pẹ̀lú ẹnikẹ́ni.'],
  ['That’s the tour. Come and find me at Campus, north of the plaza, and I’ll place you as a Normie or a Homie.', 'هذه هي الجولة. تعال وابحث عني في الحرم الجامعي شمال الساحة، وسأحدد إن كنت مبتدئًا (Normie) أو خبيرًا (Homie).', '导览结束。到广场北边的校园来找我，我会判断你是新手（Normie）还是老手（Homie）。', 'Ese es el recorrido. Ven a buscarme al Campus, al norte de la plaza, y te ubicaré como Normie o Homie.', 'Wannan shi ne rangadin. Zo ka same ni a Campus, arewacin dandali, zan sanya ka a matsayin Normie ko Homie.', 'Hiyo ndiyo ziara. Njoo unitafute Campus, kaskazini mwa uwanja, nami nitakuweka kama Normie au Homie.', 'ツアーはここまで。広場の北にあるキャンパスで会いましょう。ノーミーかホーミーか判定しますね。', '투어는 여기까지예요. 광장 북쪽 캠퍼스로 저를 찾아오세요. 노미인지 호미인지 정해 드릴게요.', 'Tur bu kadar. Meydanın kuzeyindeki kampüste beni bul, seni Normie ya da Homie olarak yerleştireyim.', "C'est tout pour la visite. Viens me retrouver au Campus, au nord de la place, et je te classerai Normie ou Homie.", 'Esse foi o tour. Venha me encontrar no Campus, ao norte da praça, e eu te classifico como Normie ou Homie.', 'टूर बस इतना ही। प्लाज़ा के उत्तर में कैंपस में मुझसे मिलिए, मैं बताऊँगी कि आप Normie हैं या Homie।', 'Ìrìn àjò náà nìyẹn. Wá rí mi ní Campus, ní àríwá gbàgede, màá sì pín ọ sí Normie tàbí Homie.'],
  ['Hi, I’m Zahra, your guide here at Campus. I help everyone find their feet in Web3. Want a quick tour, or shall we start your next lesson?', 'مرحبًا، أنا زهراء، مرشدتك هنا في الحرم الجامعي. أساعد الجميع على بدء طريقهم في Web3. هل تريد جولة سريعة، أم نبدأ درسك التالي؟', '你好，我是扎赫拉，校园里的向导。我帮大家在 Web3 里站稳脚跟。要快速逛逛，还是开始下一课？', 'Hola, soy Zahra, tu guía aquí en el Campus. Ayudo a todos a dar sus primeros pasos en Web3. ¿Quieres un recorrido rápido o empezamos tu próxima lección?', 'Sannu, ni ce Zahra, jagorarka a Campus. Ina taimaka wa kowa ya fara a Web3. Kana son ɗan rangadi, ko mu fara darasinka na gaba?', 'Habari, mimi ni Zahra, kiongozi wako hapa Campus. Ninamsaidia kila mtu kuanza vizuri katika Web3. Unataka ziara fupi, au tuanze somo lako lijalo?', 'こんにちは、キャンパス案内のザフラです。みんなが Web3 の第一歩を踏み出せるようお手伝いしています。軽く案内しましょうか、それとも次のレッスンを始めますか？', '안녕하세요, 캠퍼스 가이드 자흐라예요. 모두가 Web3에 첫발을 내딛도록 돕고 있어요. 짧게 둘러볼까요, 아니면 다음 수업을 시작할까요?', 'Merhaba, ben Zahra, kampüsteki rehberin. Herkesin Web3’te ilk adımlarını atmasına yardım ediyorum. Hızlı bir tur mu istersin, yoksa sıradaki dersine mi başlayalım?', "Salut, je suis Zahra, ta guide ici au Campus. J'aide chacun à faire ses premiers pas dans le Web3. Tu veux une petite visite, ou on commence ta prochaine leçon ?", 'Oi, eu sou a Zahra, sua guia aqui no Campus. Ajudo todo mundo a dar os primeiros passos na Web3. Quer um tour rápido ou começamos sua próxima lição?', 'नमस्ते, मैं ज़हरा हूँ, कैंपस में आपकी गाइड। मैं सबको Web3 में क़दम जमाने में मदद करती हूँ। छोटा सा टूर चाहिए, या आपका अगला पाठ शुरू करें?', 'Báwo, èmi ni Zahra, atọ́nà rẹ níbí ní Campus. Mo ń ran gbogbo ènìyàn lọ́wọ́ láti bẹ̀rẹ̀ nínú Web3. Ṣé o fẹ́ ìrìn àjò kúkúrú, àbí ká bẹ̀rẹ̀ ẹ̀kọ́ rẹ tó kàn?'],
]
const TABLE = new Map<string, Record<string, string>>()
for (const [en, ...tr] of ROWS) { const m: Record<string, string> = {}; ORDER.forEach((l, i) => { if (tr[i]) m[l] = tr[i]! }); TABLE.set(en!, m) }
// Extra strings other modules add (birthdays, holidays…) register here.
export function addStrings(rows: string[][]): void { values = null; for (const [en, ...tr] of rows) { const m: Record<string, string> = TABLE.get(en!) ?? {}; ORDER.forEach((l, i) => { if (tr[i]) m[l] = tr[i]! }); TABLE.set(en!, m) } if (current !== 'en-GB') retranslate() }

// English (US): the game is written with UK spelling.
const US: Array<[RegExp, string]> = [
  [/\bPractise\b/g, 'Practice'], [/\bpractise\b/g, 'practice'], [/\bcentre\b/g, 'center'], [/\bCentre\b/g, 'Center'], [/\bcolour/g, 'color'], [/\bColour/g, 'Color'],
  [/\bfavourite/g, 'favorite'], [/\bjewellery\b/g, 'jewelry'], [/\bJewellery\b/g, 'Jewelry'], [/\bprogramme\b/g, 'program'], [/\bProgramme\b/g, 'Program'],
  [/\blicence\b/g, 'license'], [/\borganis/g, 'organiz'], [/\brecognis/g, 'recogniz'], [/\bbehaviour/g, 'behavior'], [/\btravell/g, 'travel'],
]

const KEY = 'gd.lang'
const read = (): LangId | null => { try { const v = localStorage.getItem(KEY); return LANGS.some((l) => l.id === v) ? (v as LangId) : null } catch { return null } }
function guess(): LangId {
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en-GB') || 'en-GB'
  if (/^en-US/i.test(nav)) return 'en-US'
  const hit = LANGS.find((l) => !l.id.startsWith('en') && nav.toLowerCase().startsWith(l.id))
  return hit?.id ?? 'en-GB'
}
let current: LangId = read() ?? guess()
export const lang = (): LangId => current
export const speechLang = (): string => LANGS.find((l) => l.id === current)?.speech ?? 'en-GB'
export const isEnglish = (): boolean => current.startsWith('en')

/** True when `text` is an English UI string that has a translation in the current language (not shown yet). */
export const untranslated = (text: string): boolean => !current.startsWith('en') && !!TABLE.get(text.trim())?.[current]
let values: { lang: string; set: Set<string> } | null = null
/** True when `text` is one of the current language's translations. */
export function isTranslation(text: string): boolean {
  if (!values || values.lang !== current) { values = { lang: current, set: new Set([...TABLE.values()].map((m) => m[current]).filter((v): v is string => !!v)) } }
  return values.set.has(text.trim())
}
/** The chosen language's text for an English UI string (unchanged when there is none). */
export function t(en: string): string {
  if (current === 'en-GB') return en
  if (current === 'en-US') { let s = en; for (const [re, to] of US) s = s.replace(re, to); return s }
  return TABLE.get(en)?.[current] ?? en
}
function translate(text: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)
  if (!m || !m[2]) return text
  const out = t(m[2])
  return out === m[2] ? text : `${m[1]}${out}${m[3]}`
}

// Player content and the printable CV stay as written.
const SKIP = 'script, style, textarea, input, select, canvas, svg, [data-no-i18n], .cv-paper, #chat-log, .chat-log, .dm-lines, .dm-thread, .nameplate strong, .npc-card b'
const seen = new WeakMap<Node, { en: string; shown: string }>()
function textNode(n: Text): void {
  const p = n.parentElement
  if (!p || p.closest(SKIP)) return
  const rec = seen.get(n)
  if (rec && n.data === rec.shown) return
  const en = n.data
  const shown = translate(en)
  seen.set(n, { en, shown })
  if (shown !== en) n.data = shown
}
const ATTRS = ['placeholder', 'aria-label', 'title'] as const
function element(el: Element): void {
  if (el.closest(SKIP)) return
  for (const a of ATTRS) {
    const v = el.getAttribute(a); if (!v) continue
    const key = `data-i18n-${a}`
    const en = el.getAttribute(key) ?? v
    if (!el.hasAttribute(key)) el.setAttribute(key, v)
    const shown = translate(en)
    if (shown !== v) el.setAttribute(a, shown)
  }
}
function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) { textNode(root as Text); return }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  if (el.closest(SKIP)) return
  element(el)
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) textNode(n as Text)
    else element(n as Element)
  }
}
/** Put every node back to its English source, then translate into the current language. */
function retranslate(): void {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { const rec = seen.get(n); if (rec && n.nodeValue === rec.shown) { (n as Text).data = rec.en; seen.delete(n) } }
  document.querySelectorAll('[data-i18n-placeholder], [data-i18n-aria-label], [data-i18n-title]').forEach((el) => {
    for (const a of ATTRS) { const en = el.getAttribute(`data-i18n-${a}`); if (en !== null) el.setAttribute(a, en) }
  })
  if (current !== 'en-GB') walk(document.body)
}
let observer: MutationObserver | null = null
function applyDoc(): void {
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : current
  document.documentElement.dataset.lang = current
}
/** Start translating the page (call once at boot). English (UK) costs nothing: no observer runs. */
export function startI18n(): void {
  applyDoc()
  if (current === 'en-GB' || observer) return
  walk(document.body)
  observer = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') textNode(m.target as Text)
      else m.addedNodes.forEach((n) => walk(n))
    }
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
}
export function setLang(id: LangId): void {
  if (!LANGS.some((l) => l.id === id) || id === current) return
  current = id
  try { localStorage.setItem(KEY, id) } catch { /* this session only */ }
  applyDoc()
  retranslate()
  startI18n()
  window.dispatchEvent(new CustomEvent('gd:lang', { detail: id }))
}
/** A language picker (native select, styled as a 3D pill). */
export function languagePicker(cls = 'lang-pick'): HTMLLabelElement {
  const label = document.createElement('label')
  label.className = cls
  label.dataset.noI18n = ''
  const globe = document.createElement('span'); globe.textContent = '🌐'; globe.setAttribute('aria-hidden', 'true')
  const sel = document.createElement('select')
  sel.setAttribute('aria-label', 'Language')
  for (const l of LANGS) { const o = document.createElement('option'); o.value = l.id; o.textContent = l.name; sel.append(o) }
  sel.value = current
  sel.onchange = () => setLang(sel.value as LangId)
  window.addEventListener('gd:lang', () => { sel.value = current })
  label.append(globe, sel)
  return label
}
