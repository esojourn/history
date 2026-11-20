/* 示例数据与共用工具。
 * 仅用于演示展现形式：年代取通行说法，尚未逐条核对出处，正式数据另行录入。
 * 年份一律用天文纪年整数：公元前 n 年 = 1 - n（公元前 221 年 = -220）。 */
(function () {
  const B = n => 1 - n;
  const H = (window.H = {});

  H.B = B;
  H.fmt = y => (y <= 0 ? `前${1 - y}` : `${y}`);
  H.fmtFull = y => (y <= 0 ? `公元前 ${1 - y} 年` : `公元 ${y} 年`);
  H.EXTENT = [-3000, 2000];
  H.FOCUS = [B(262), B(138)]; // 已录入人物的范围

  /* ---------- 文明泳道：[名称, 起, 止, 确定度]　t = 传统说法/约数　l = 传说、不标年份 ---------- */
  H.lanes = [
    { id: 'bible', name: '圣经历史', c: '#B5851A', bands: [
      ['太初：创世、洪水、巴别（只排先后，不标年份）', -3000, B(2100), 'l'],
      ['族长时期', B(2100), B(1800), 't'], ['寄居埃及', B(1800), B(1300), 't'],
      ['出埃及与士师', B(1300), B(1050), 't'], ['联合王国', B(1050), B(930)],
      ['南北分国', B(930), B(586)], ['被掳', B(586), B(538)],
      ['第二圣殿时期', B(538), B(4)], ['新约时代', B(4), 100], ['早期教会', 100, 313]] },
    { id: 'meso', name: '两河与波斯', c: '#A0623A', bands: [
      ['苏美尔城邦', B(2900), B(2334), 't'], ['阿卡德', B(2334), B(2154)], ['乌尔第三王朝', B(2112), B(2004)],
      ['古巴比伦', B(1894), B(1595)], ['加喜特巴比伦', B(1595), B(1155)], ['亚述帝国', B(911), B(612)],
      ['新巴比伦', B(612), B(539)], ['波斯帝国', B(539), B(330)], ['塞琉古', B(330), B(141)],
      ['安息', B(141), 224], ['萨珊波斯', 224, 651], ['阿拉伯帝国', 651, 1258]] },
    { id: 'egypt', name: '埃及', c: '#7A5A91', bands: [
      ['早王朝', B(3100), B(2686), 't'], ['古王国', B(2686), B(2181)], ['第一中间期', B(2181), B(2055)],
      ['中王国', B(2055), B(1650)], ['第二中间期', B(1650), B(1550)], ['新王国', B(1550), B(1069)],
      ['后期埃及', B(1069), B(332)], ['托勒密王朝', B(332), B(30)], ['罗马与拜占庭治下', B(30), 641]] },
    { id: 'greece', name: '希腊', c: '#2F6F9F', bands: [
      ['爱琴文明', B(2000), B(1100), 't'], ['黑暗时代', B(1100), B(800), 't'], ['古风时期', B(800), B(480)],
      ['古典时期', B(480), B(323)], ['希腊化时代', B(323), B(146)]] },
    { id: 'rome', name: '罗马与欧洲', c: '#A8456B', bands: [
      ['王政', B(753), B(509), 't'], ['罗马共和国', B(509), B(27)], ['罗马帝国', B(27), 476],
      ['中世纪前期', 476, 1000], ['中世纪盛期', 1000, 1300], ['中世纪晚期', 1300, 1453],
      ['文艺复兴与宗教改革', 1453, 1648], ['启蒙与革命', 1648, 1815], ['工业时代', 1815, 1914],
      ['两次大战', 1914, 1945], ['战后', 1945, 2000]] },
    { id: 'india', name: '印度', c: '#C9702B', bands: [
      ['印度河文明', B(2600), B(1900), 't'], ['吠陀时代', B(1500), B(600), 't'], ['列国时代', B(600), B(322)],
      ['孔雀王朝', B(322), B(185)], ['贵霜等诸国', B(185), 320], ['笈多王朝', 320, 550],
      ['诸王国并立', 550, 1206], ['德里苏丹国', 1206, 1526], ['莫卧儿帝国', 1526, 1857],
      ['英属印度', 1858, 1947], ['共和国', 1947, 2000]] },
    { id: 'china', name: '中国', c: '#C4472D', bands: [
      ['五帝传说时代', -3000, B(2070), 'l'], ['夏', B(2070), B(1600), 't'], ['商', B(1600), B(1046), 't'],
      ['西周', B(1046), B(771)], ['春秋', B(770), B(476)], ['战国', B(475), B(221)],
      ['秦', B(221), B(207)], ['楚汉', B(206), B(202)], ['西汉', B(202), 8], ['新', 9, 23], ['东汉', 25, 220],
      ['三国', 220, 266], ['西晋', 266, 316], ['东晋十六国', 317, 420], ['南北朝', 420, 589],
      ['隋', 589, 618], ['唐', 618, 907], ['五代十国', 907, 960], ['北宋与辽', 960, 1127],
      ['南宋与金', 1127, 1279], ['元', 1279, 1368], ['明', 1368, 1644], ['清', 1644, 1912],
      ['民国', 1912, 1949], ['共和国', 1949, 2000]] },
    { id: 'korea', name: '朝鲜半岛', c: '#2F8F83', bands: [
      ['古朝鲜', B(1000), B(108), 't'], ['三国时代', B(57), 668], ['统一新罗与渤海', 668, 935],
      ['高丽', 936, 1392], ['朝鲜王朝', 1392, 1897], ['大韩帝国', 1897, 1910], ['日据', 1910, 1945],
      ['南北分治', 1945, 2000]] },
    { id: 'japan', name: '日本', c: '#3D4F8A', bands: [
      ['绳文时代', -3000, B(300), 't'], ['弥生时代', B(300), 250, 't'], ['古坟时代', 250, 538],
      ['飞鸟时代', 538, 710], ['奈良', 710, 794], ['平安时代', 794, 1185], ['镰仓幕府', 1185, 1333],
      ['室町幕府', 1336, 1573], ['安土桃山', 1573, 1603], ['江户幕府', 1603, 1868],
      ['明治与大正', 1868, 1926], ['昭和与平成', 1926, 2000]] },
  ];
  H.lane = id => H.lanes.find(l => l.id === id);
  H.bandAt = (lane, y) => lane.bands.find(b => y >= b[1] && y < b[2]);

  /* ---------- 阵营（秦尚黑、汉尚赤，取其本色） ---------- */
  H.FAC = {
    qin: { n: '秦廷', c: '#39464D' }, chu: { n: '反秦与楚', c: '#2F8F83' },
    han: { n: '汉', c: '#C4472D' }, xiongnu: { n: '匈奴', c: '#A0623A' },
  };

  /* ---------- 人物　b = null 表示生年不详 ---------- */
  const P = (id, n, b, d, imp, fac, ch, role, sum, x) => Object.assign({ id, n, b, d, imp, fac, ch, role, sum }, x);
  H.people = [
    P('ying-zheng', '秦始皇', B(259), B(210), 5, 'qin', 'qin', '皇帝', '名嬴政。十年间灭六国，建立第一个统一的中央集权王朝，自称“始皇帝”。', { alt: '嬴政', reign: [B(247), B(210)] }),
    P('li-si', '李斯', B(284), B(208), 4, 'qin', 'qin', '丞相', '辅佐始皇统一文字与度量衡；沙丘之变后为赵高所害。', { circa: 1 }),
    P('zhao-gao', '赵高', null, B(207), 3, 'qin', 'qin', '中车府令', '沙丘矫诏拥立胡亥，专权乱政，后为子婴所杀。'),
    P('meng-tian', '蒙恬', null, B(210), 2, 'qin', 'qin', '将军', '北击匈奴，监修长城；沙丘之变后被迫自尽。'),
    P('fu-su', '扶苏', null, B(210), 2, 'qin', 'qin', '公子', '始皇长子，因劝谏被派往上郡，遭矫诏赐死。'),
    P('hu-hai', '秦二世', B(230), B(207), 3, 'qin', 'qin', '皇帝', '名胡亥，始皇少子。在位三年，被赵高逼迫自杀。', { alt: '胡亥', circa: 1, reign: [B(210), B(207)] }),
    P('chen-sheng', '陈胜', null, B(208), 3, 'chu', 'qin', '起义首领', '大泽乡揭竿而起，建立“张楚”政权，首开反秦之局。'),
    P('xiang-yu', '项羽', B(232), B(202), 5, 'chu', 'chuhan', '西楚霸王', '巨鹿破秦，分封诸侯；楚汉相争兵败垓下，自刎乌江。', { reign: [B(206), B(202)] }),
    P('fan-zeng', '范增', B(277), B(204), 3, 'chu', 'chuhan', '谋士', '项羽尊为“亚父”。鸿门宴力主除掉刘邦，后遭离间而去。'),
    P('yu-ji', '虞姬', null, B(202), 1, 'chu', 'chuhan', '项羽姬妾', '随项羽征战，垓下被围时自尽。'),
    P('liu-bang', '汉高祖', B(256), B(195), 5, 'han', 'chuhan', '皇帝', '名刘邦。起于沛县，先入关中，击败项羽后建立汉朝。', { alt: '刘邦', circa: 1, reign: [B(202), B(195)] }),
    P('xiao-he', '萧何', B(257), B(193), 4, 'han', 'chuhan', '丞相', '留守关中、供给军需，制定律令；举荐韩信为大将。', { circa: 1 }),
    P('zhang-liang', '张良', B(250), B(186), 4, 'han', 'chuhan', '谋士', '运筹帷幄，鸿门宴助刘邦脱险；功成后退隐。', { circa: 1 }),
    P('han-xin', '韩信', B(231), B(196), 4, 'han', 'chuhan', '大将军', '登坛拜将，定三秦、破赵、灭齐，围项羽于垓下；后被吕后诛杀。', { circa: 1 }),
    P('fan-kuai', '樊哙', B(242), B(189), 2, 'han', 'chuhan', '将军', '沛县旧部，鸿门宴闯帐护主；娶吕后之妹。'),
    P('peng-yue', '彭越', null, B(196), 2, 'han', 'chuhan', '梁王', '袭扰楚军粮道，汉初封王，后被诛。'),
    P('modu', '冒顿单于', B(234), B(174), 3, 'xiongnu', 'chuhan', '匈奴单于', '弑父自立，统一草原；在白登围困汉高祖。', { circa: 1, reign: [B(209), B(174)] }),
    P('lv-zhi', '吕后', B(241), B(180), 4, 'han', 'xihan', '皇后，临朝称制', '名吕雉。高祖死后掌权十五年，分封诸吕为王。', { alt: '吕雉', reign: [B(187), B(180)] }),
    P('chen-ping', '陈平', null, B(178), 3, 'han', 'xihan', '丞相', '屡出奇计；吕后死后与周勃平定诸吕，迎立文帝。'),
    P('zhou-bo', '周勃', null, B(169), 3, 'han', 'xihan', '太尉、丞相', '随高祖起兵，后与陈平平定诸吕之乱。'),
    P('cao-shen', '曹参', null, B(190), 2, 'han', 'xihan', '丞相', '继萧何为相，沿用旧法，世称“萧规曹随”。'),
    P('liu-ying', '汉惠帝', B(210), B(188), 2, 'han', 'xihan', '皇帝', '名刘盈，高祖与吕后之子，在位时实权在吕后。', { alt: '刘盈', reign: [B(195), B(188)] }),
    P('liu-heng', '汉文帝', B(203), B(157), 4, 'han', 'xihan', '皇帝', '名刘恒。轻徭薄赋，废除肉刑，开启“文景之治”。', { alt: '刘恒', reign: [B(180), B(157)] }),
    P('liu-qi', '汉景帝', B(188), B(141), 3, 'han', 'xihan', '皇帝', '名刘启。削藩引发七国之乱，平定后中央集权加强。', { alt: '刘启', reign: [B(157), B(141)] }),
    P('jia-yi', '贾谊', B(200), B(168), 2, 'han', 'xihan', '政论家', '作《过秦论》《治安策》，主张削弱诸侯。'),
    P('chao-cuo', '晁错', B(200), B(154), 2, 'han', 'xihan', '御史大夫', '力主削藩。七国之乱起，被景帝处死以谢诸侯。'),
    P('zhou-yafu', '周亚夫', B(199), B(143), 2, 'han', 'xihan', '太尉', '周勃之子，细柳营治军严明，三个月平定七国之乱。'),
    P('liu-pi', '刘濞', B(215), B(154), 2, 'han', 'xihan', '吴王', '高祖之侄，经营吴国四十年，发动七国之乱，兵败被杀。'),
  ];
  H.P = Object.fromEntries(H.people.map(p => [p.id, p]));
  // 生年不详者，从估计的年份画一段渐隐的条（估计值只用于作图，不显示为数字）
  const EST = { 'zhou-bo': B(240), 'chen-ping': B(240), 'yu-ji': B(230) };
  H.people.forEach(p => { p.b0 = p.b != null ? p.b : (EST[p.id] != null ? EST[p.id] : p.d - 50); });
  H.life = p => `${p.b == null ? '生年不详' : (p.circa ? '约' : '') + H.fmt(p.b)}—${H.fmt(p.d)}`;

  /* ---------- 事件 ---------- */
  const E = (id, n, s, e, imp, who, sum) => ({ id, n, s, e: e == null ? s : e, imp, who, sum });
  H.events = [
    E('unify', '秦灭六国', B(230), B(221), 5, ['ying-zheng', 'li-si'], '十年间先后灭韩、赵、魏、楚、燕、齐，天下归于一统。'),
    E('burn', '焚书坑儒', B(213), B(212), 3, ['ying-zheng', 'li-si', 'fu-su'], '采纳李斯之议焚毁民间藏书，次年坑杀方士儒生；扶苏劝谏被外放。'),
    E('shaqiu', '沙丘之变', B(210), null, 4, ['ying-zheng', 'zhao-gao', 'li-si', 'hu-hai', 'fu-su', 'meng-tian'], '始皇病逝于沙丘，赵高与李斯矫诏立胡亥，赐死扶苏、蒙恬。'),
    E('daze', '大泽乡起义', B(209), null, 4, ['chen-sheng'], '陈胜、吴广率戍卒起事，各地纷纷响应。'),
    E('julu', '巨鹿之战', B(207), null, 4, ['xiang-yu'], '项羽破釜沉舟，大败秦军主力。'),
    E('hongmen', '鸿门宴', B(206), null, 4, ['xiang-yu', 'liu-bang', 'fan-zeng', 'zhang-liang', 'fan-kuai'], '范增欲借宴席除掉刘邦，张良、樊哙护其脱身。'),
    E('chuhan', '楚汉相争', B(206), B(202), 5, ['liu-bang', 'xiang-yu', 'han-xin', 'xiao-he', 'zhang-liang', 'chen-ping', 'peng-yue'], '刘邦与项羽争夺天下，历时四年有余。'),
    E('jingxing', '井陉背水一战', B(204), null, 2, ['han-xin'], '韩信背水列阵，以少胜多击破赵军。'),
    E('gaixia', '垓下之战', B(202), null, 5, ['xiang-yu', 'liu-bang', 'han-xin', 'peng-yue', 'yu-ji'], '汉军合围，四面楚歌，项羽突围至乌江自刎。'),
    E('baideng', '白登之围', B(200), null, 3, ['liu-bang', 'modu', 'chen-ping'], '高祖亲征匈奴被围七日，用陈平计得脱，此后行和亲之策。'),
    E('hanxin-death', '韩信被杀', B(196), null, 3, ['han-xin', 'lv-zhi', 'xiao-he'], '吕后与萧何设计，将韩信诱至长乐宫处死。'),
    E('zhulv', '平定诸吕', B(180), null, 4, ['chen-ping', 'zhou-bo', 'liu-heng'], '吕后去世，陈平、周勃诛灭诸吕，迎立代王刘恒。'),
    E('wenjing', '文景之治', B(180), B(141), 4, ['liu-heng', 'liu-qi'], '两代皇帝与民休息，国力恢复。'),
    E('qiguo', '七国之乱', B(154), null, 4, ['liu-qi', 'liu-pi', 'zhou-yafu', 'chao-cuo'], '吴楚等七国以“诛晁错”为名起兵，三个月即被平定。'),
  ];
  H.E = Object.fromEntries(H.events.map(e => [e.id, e]));
  H.span = e => (e.e > e.s ? `${H.fmt(e.s)}—${H.fmt(e.e)}` : H.fmt(e.s));

  /* ---------- 同期的世界 ---------- */
  H.world = [
    ['rome', '第一次布匿战争', B(264), B(241)], ['rome', '第二次布匿战争', B(218), B(201)],
    ['rome', '罗马毁灭迦太基', B(146), B(146)], ['india', '阿育王在位', B(268), B(232)],
    ['egypt', '罗塞塔石碑刻成', B(196), B(196)], ['bible', '七十士译本始译（传统说法）', B(250), B(250)],
    ['bible', '马加比起义', B(167), B(160)], ['greece', '马其顿亡于罗马', B(168), B(168)],
  ].map(([lane, n, s, e]) => ({ lane, n, s, e }));

  /* ---------- 关系：[甲, 乙, 类型, 说明, 关键年份(可选)] ---------- */
  H.RT = {
    kin: { n: '亲属', c: '#C4472D' }, lord: { n: '君臣', c: '#2F6F9F' },
    rival: { n: '敌对', c: '#1B2A31', dash: '5 4' }, ally: { n: '同袍', c: '#2F8F83' },
    mentor: { n: '举荐、师友', c: '#B5851A' },
  };
  H.rels = [
    ['ying-zheng', 'fu-su', 'kin', '父子'], ['ying-zheng', 'hu-hai', 'kin', '父子'],
    ['ying-zheng', 'li-si', 'lord', '君臣', B(221)], ['ying-zheng', 'meng-tian', 'lord', '君臣', B(215)],
    ['ying-zheng', 'zhao-gao', 'lord', '君臣'], ['zhao-gao', 'hu-hai', 'mentor', '师傅，拥立', B(210)],
    ['zhao-gao', 'li-si', 'rival', '先合谋后陷害', B(208)], ['zhao-gao', 'fu-su', 'rival', '矫诏赐死', B(210)],
    ['meng-tian', 'fu-su', 'ally', '同守上郡', B(212)], ['chen-sheng', 'hu-hai', 'rival', '起兵反秦', B(209)],
    ['xiang-yu', 'fan-zeng', 'lord', '尊为亚父', B(207)], ['xiang-yu', 'yu-ji', 'kin', '伴侣'],
    ['xiang-yu', 'liu-bang', 'rival', '争天下', B(203)], ['xiang-yu', 'han-xin', 'rival', '旧部转敌', B(202)],
    ['fan-zeng', 'liu-bang', 'rival', '鸿门宴欲除之', B(206)],
    ['liu-bang', 'lv-zhi', 'kin', '夫妻'], ['liu-bang', 'liu-ying', 'kin', '父子'], ['liu-bang', 'liu-heng', 'kin', '父子'],
    ['lv-zhi', 'liu-ying', 'kin', '母子'], ['liu-heng', 'liu-qi', 'kin', '父子'], ['liu-bang', 'liu-pi', 'kin', '叔侄'],
    ['liu-bang', 'xiao-he', 'lord', '君臣', B(206)], ['liu-bang', 'zhang-liang', 'lord', '君臣', B(207)],
    ['liu-bang', 'han-xin', 'lord', '君臣', B(205)], ['liu-bang', 'chen-ping', 'lord', '君臣', B(204)],
    ['liu-bang', 'fan-kuai', 'lord', '君臣，连襟'], ['liu-bang', 'zhou-bo', 'lord', '君臣'],
    ['liu-bang', 'cao-shen', 'lord', '君臣'], ['liu-bang', 'peng-yue', 'lord', '君臣', B(203)],
    ['liu-bang', 'modu', 'rival', '白登之围', B(200)],
    ['xiao-he', 'han-xin', 'mentor', '举荐', B(206)], ['xiao-he', 'cao-shen', 'ally', '萧规曹随', B(193)],
    ['zhang-liang', 'han-xin', 'ally', '同列三杰', B(203)], ['lv-zhi', 'han-xin', 'rival', '诛杀', B(196)],
    ['lv-zhi', 'peng-yue', 'rival', '诛杀', B(196)], ['lv-zhi', 'fan-kuai', 'kin', '姻亲'],
    ['chen-ping', 'zhou-bo', 'ally', '共诛诸吕', B(180)], ['zhou-bo', 'liu-heng', 'lord', '迎立', B(180)],
    ['chen-ping', 'liu-heng', 'lord', '迎立', B(180)], ['zhou-bo', 'zhou-yafu', 'kin', '父子'],
    ['liu-heng', 'jia-yi', 'lord', '君臣', B(179)], ['liu-qi', 'chao-cuo', 'lord', '君臣，师生', B(157)],
    ['liu-qi', 'zhou-yafu', 'lord', '君臣', B(154)], ['liu-qi', 'liu-pi', 'rival', '七国之乱', B(154)],
    ['zhou-yafu', 'liu-pi', 'rival', '平叛', B(154)], ['chao-cuo', 'liu-pi', 'rival', '削藩', B(155)],
  ].map(([a, b, t, label, year]) => ({ a, b, t, label, year }));

  H.relsOf = id => H.rels.filter(r => r.a === id || r.b === id).map(r => {
    const o = H.P[r.a === id ? r.b : r.a], me = H.P[id];
    const lo = Math.max(o.b0, me.b0), hi = Math.min(o.d, me.d);
    return { o, t: r.t, label: r.label, year: r.year != null ? r.year : (lo + hi) / 2 };
  });
  H.eventsOf = id => H.events.filter(e => e.who.includes(id));

  /* ---------- 分章（长卷用） ---------- */
  H.chapters = [
    { id: 'qin', n: '秦', s: B(221), e: B(207), sum: '六国归一，书同文、车同轨。帝国只存在了十四年。' },
    { id: 'chuhan', n: '楚汉相争', s: B(206), e: B(202), sum: '秦亡之后，项羽与刘邦争夺天下。' },
    { id: 'xihan', n: '西汉前期', s: B(202), e: B(141), sum: '从高祖立国到文景之治，新王朝站稳脚跟。' },
  ];

  /* ---------- 工具 ---------- */
  H.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  H.lerp = (a, b, f) => a + (b - a) * f;
  // 排行：把时间上不重叠的条放进同一行。按传入顺序占位，所以先传重要的，它们的行号就稳定。
  H.pack = (items, s, e, gap = 0, key = 'row') => {
    const rows = [];
    items.forEach(it => {
      let r = rows.findIndex(row => row.every(q => e(q) + gap <= s(it) || e(it) + gap <= s(q)));
      if (r < 0) { r = rows.length; rows.push([]); }
      rows[r].push(it); it[key] = r;
    });
    return rows.length;
  };
  H.byWeight = list => [...list].sort((a, b) => b.imp - a.imp || a.b0 - b.b0);

  /* ---------- 共用的详情卡 ---------- */
  H.detail = id => {
    const p = H.P[id], rs = H.relsOf(id), es = H.eventsOf(id);
    return `<div class="d-head"><h2>${p.n}</h2>${p.alt ? `<span class="d-alt">${p.alt}</span>` : ''}</div>
      <p class="d-meta"><b>${H.life(p)}</b>　${p.role}${p.reign ? `，${H.fmt(p.reign[0])}—${H.fmt(p.reign[1])} 在位` : ''}</p>
      <p class="d-sum">${p.sum}</p>
      <h3>关系</h3>
      <ul class="d-rels">${rs.map(r => `<li><button data-go="${r.o.id}"><i style="background:${H.RT[r.t].c}"></i><b>${r.o.n}</b><span>${r.label}</span></button></li>`).join('')}</ul>
      ${es.length ? `<h3>参与的事件</h3><ul class="d-evs">${es.map(e => `<li><b>${H.span(e)}</b>${e.n}</li>`).join('')}</ul>` : ''}`;
  };
  H.eventDetail = id => {
    const e = H.E[id];
    return `<div class="d-head"><h2>${e.n}</h2></div>
      <p class="d-meta"><b>${H.span(e)}</b></p><p class="d-sum">${e.sum}</p>
      <h3>相关人物</h3>
      <ul class="d-rels">${e.who.map(w => `<li><button data-go="${w}"><i style="background:${H.FAC[H.P[w].fac].c}"></i><b>${H.P[w].n}</b><span>${H.P[w].role}</span></button></li>`).join('')}</ul>`;
  };
  H.legend = () => Object.values(H.RT).map(t =>
    `<span class="lg"><i style="border-top:2px ${t.dash ? 'dashed' : 'solid'} ${t.c}"></i>${t.n}</span>`).join('');
  H.isMobile = () => window.matchMedia('(max-width: 720px)').matches;
})();
