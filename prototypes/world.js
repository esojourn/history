/* 方案 A 的扩充数据：秦汉同期的其他文明与民族。只有 a-river.html 加载，方案 B、C 仍用原来的 28 人。
 * 同样只为演示形式：年代取通行说法，带“约”的和标为传统说法的尤其需要核对。 */
(function () {
  const H = window.H, B = H.B;

  /* ---------- 新增两条泳道 ---------- */
  H.lanes.splice(H.lanes.findIndex(l => l.id === 'china'), 0, { id: 'steppe', name: '北方草原', c: '#6E7B3A', bands: [
    ['草原诸部：东胡、月氏、匈奴', B(700), B(209), 't'], ['匈奴', B(209), 93], ['鲜卑', 93, 330, 't'],
    ['柔然', 330, 552], ['突厥', 552, 744], ['回鹘', 744, 840], ['诸部并立', 840, 1206],
    ['蒙古帝国', 1206, 1368], ['蒙古诸部', 1368, 1691], ['清朝治下', 1691, 1911], ['蒙古国', 1911, 2000]] });
  H.lanes.push({ id: 'yue', name: '百越与东南亚', c: '#4F8F5B', bands: [
    ['东山文化与百越', B(600), B(204), 't'], ['南越国', B(204), B(111)], ['交趾等郡', B(111), 100],
    ['扶南与占婆', 100, 550, 't'], ['真腊与室利佛逝', 550, 802, 't'], ['吴哥王朝等', 802, 1431],
    ['诸国并立', 1431, 1824], ['殖民时代', 1824, 1945], ['独立诸国', 1945, 2000]] });

  /* ---------- 阵营颜色：默认跟泳道走，同一泳道里对立的两方另给一色 ---------- */
  H.lanes.forEach(l => { if (!H.FAC[l.id]) H.FAC[l.id] = { n: l.name, c: l.c }; });
  Object.assign(H.FAC, { carthage: { n: '迦太基', c: '#4E5A7A' }, parthia: { n: '安息', c: '#6B4A2F' } });
  H.FAC.xiongnu.c = H.lane('steppe').c;
  H.RT.ally.n = '同盟、同袍';

  /* ---------- 人物　e0 = 生年不详时作图用的估计起点 ---------- */
  const W = (id, n, lane, b, d, imp, role, sum, x) => Object.assign({ id, n, lane, b, d, imp, fac: lane, role, sum }, x);
  H.people.forEach(p => { p.lane = 'china'; });
  Object.assign(H.P.modu, { lane: 'steppe', imp: 4 });
  H.people.push(
    // 罗马与迦太基
    W('hamilcar', '哈米尔卡', 'rome', B(275), B(228), 2, '迦太基将领', '汉尼拔之父。第一次布匿战争中坚守西西里，战后经营西班牙。', { fac: 'carthage', circa: 1 }),
    W('hannibal', '汉尼拔', 'rome', B(247), B(183), 5, '迦太基统帅', '翻越阿尔卑斯山攻入意大利，坎尼一役重创罗马；后在扎马败于西庇阿，流亡东方。', { fac: 'carthage', dc: 1 }),
    W('fabius', '费边', 'rome', B(280), B(203), 3, '罗马独裁官', '以拖延、消耗的办法对付汉尼拔，人称“拖延者”。', { circa: 1 }),
    W('marcellus', '马塞卢斯', 'rome', B(268), B(208), 2, '罗马执政官', '围攻并攻陷叙拉古；后中汉尼拔伏击阵亡。', { circa: 1 }),
    W('scipio', '大西庇阿', 'rome', B(236), B(183), 4, '罗马统帅', '夺取西班牙，渡海进攻非洲，在扎马击败汉尼拔。'),
    W('cato', '老加图', 'rome', B(234), B(149), 3, '罗马监察官', '以守旧严厉著称，力主“迦太基必须毁灭”。'),
    W('aemilianus', '小西庇阿', 'rome', B(185), B(129), 3, '罗马统帅', '大西庇阿过继之孙。公元前 146 年攻毁迦太基。'),
    // 希腊
    W('archimedes', '阿基米德', 'greece', B(287), B(212), 4, '数学家、工程师', '叙拉古人。发现浮力与杠杆原理；城破时被罗马士兵所杀。', { circa: 1 }),
    W('chrysippus', '克律西波斯', 'greece', B(279), B(206), 2, '哲学家', '斯多葛学派第三代领袖，把这一学派的学说整理成体系。', { circa: 1, dc: 1 }),
    W('aratus', '阿拉托斯', 'greece', B(271), B(213), 2, '亚该亚同盟将军', '领导亚该亚同盟联合希腊诸城，周旋于马其顿与斯巴达之间。'),
    W('philip-v', '腓力五世', 'greece', B(238), B(179), 3, '马其顿国王', '与汉尼拔结盟对抗罗马，在库诺斯克法莱战败。', { reign: [B(221), B(179)] }),
    W('perseus', '珀尔修斯', 'greece', B(212), B(166), 2, '马其顿末代国王', '彼得那一战败于罗马，马其顿王国灭亡。', { circa: 1, reign: [B(179), B(168)] }),
    W('polybius', '波利比乌斯', 'greece', B(200), B(118), 3, '历史学家', '作为人质到罗马，与小西庇阿交好，著《历史》记述罗马的崛起。', { circa: 1, dc: 1 }),
    // 埃及
    W('ptolemy-2', '托勒密二世', 'egypt', B(308), B(246), 3, '埃及国王', '扩建亚历山大图书馆；传说七十士译本在他任内开始翻译。', { circa: 1, reign: [B(283), B(246)] }),
    W('ptolemy-3', '托勒密三世', 'egypt', B(280), B(222), 3, '埃及国王', '托勒密王朝国势最盛的时期。', { circa: 1, reign: [B(246), B(222)] }),
    W('eratosthenes', '埃拉托色尼', 'egypt', B(276), B(194), 3, '学者，亚历山大图书馆馆长', '用两地日影测算出地球周长。', { circa: 1, dc: 1 }),
    W('ptolemy-4', '托勒密四世', 'egypt', B(244), B(204), 2, '埃及国王', '在拉菲亚击败安条克三世，此后王朝转衰。', { circa: 1, reign: [B(221), B(204)] }),
    W('ptolemy-5', '托勒密五世', 'egypt', B(210), B(180), 2, '埃及国王', '幼年即位。罗塞塔石碑上刻的就是为他颁布的诏令。', { reign: [B(204), B(180)] }),
    W('ptolemy-6', '托勒密六世', 'egypt', B(186), B(145), 2, '埃及国王', '在位时安条克四世两度入侵埃及。', { circa: 1, reign: [B(180), B(145)] }),
    // 塞琉古与安息
    W('antiochus-2', '安条克二世', 'meso', B(286), B(246), 2, '塞琉古国王', '在位末年，东部的巴克特里亚、帕提亚相继脱离。', { reign: [B(261), B(246)] }),
    W('arsaces', '阿萨息斯一世', 'meso', null, B(217), 3, '安息开国君主', '率帕尔尼人占据帕提亚，建立安息王朝。', { fac: 'parthia', e0: B(270), dc: 1, reign: [B(247), B(217)] }),
    W('antiochus-3', '安条克三世', 'meso', B(241), B(187), 4, '塞琉古国王', '东征收复失地，号称“大帝”；后在马格尼西亚败于罗马。', { circa: 1, reign: [B(222), B(187)] }),
    W('antiochus-4', '安条克四世', 'meso', B(215), B(164), 3, '塞琉古国王', '入侵埃及；在耶路撒冷禁绝犹太礼俗，激起马加比起义。', { circa: 1, reign: [B(175), B(164)] }),
    W('mithridates-1', '米特里达梯一世', 'meso', B(195), B(132), 3, '安息国王', '夺取米底与两河流域，使安息成为大国。', { fac: 'parthia', circa: 1, reign: [B(171), B(132)] }),
    // 圣经历史：第二圣殿时期
    W('onias-3', '奥尼亚三世', 'bible', null, B(171), 1, '大祭司', '被安条克四世罢黜，后遭杀害。', { e0: B(225), dc: 1 }),
    W('mattathias', '玛他提亚', 'bible', null, B(166), 2, '祭司', '在莫顶拒绝向异教献祭，带领儿子们起义。', { e0: B(230) }),
    W('simon', '西门', 'bible', null, B(135), 2, '大祭司、统治者', '犹大之兄。争得犹太独立，开创哈斯蒙尼王朝。', { e0: B(205), reign: [B(142), B(135)] }),
    W('judas', '犹大·马加比', 'bible', null, B(160), 4, '起义领袖', '玛他提亚之子。屡败塞琉古军队，收复并洁净圣殿。', { e0: B(200) }),
    W('jonathan', '约拿单', 'bible', null, B(143), 2, '起义领袖、大祭司', '犹大之弟，继任领袖。', { e0: B(195) }),
    // 印度
    W('ashoka', '阿育王', 'india', B(304), B(232), 5, '孔雀王朝君主', '征服羯陵伽后悔悟，转而扶持佛教，在各地立石刻诏令。', { circa: 1, reign: [B(268), B(232)] }),
    W('pushyamitra', '弗沙密多罗', 'india', null, B(149), 2, '巽伽王朝开国君主', '孔雀王朝的将军，弑君自立。', { e0: B(215), dc: 1, reign: [B(185), B(149)] }),
    W('menander', '米南德一世', 'india', null, B(130), 3, '印度-希腊国王', '统治印度西北。佛经《弥兰陀王问经》里的弥兰陀王就是他。', { alt: '弥兰陀王', e0: B(185), dc: 1, reign: [B(165), B(130)] }),
    // 北方草原
    W('touman', '头曼单于', 'steppe', null, B(209), 2, '匈奴单于', '史书所载第一位匈奴单于，被其子冒顿所杀。', { fac: 'xiongnu', e0: B(262) }),
    W('laoshang', '老上单于', 'steppe', null, B(161), 2, '匈奴单于', '冒顿之子。击杀月氏王，迫使月氏西迁；屡次南下。', { fac: 'xiongnu', e0: B(210), reign: [B(174), B(161)] }),
    W('zhonghang-yue', '中行说', 'steppe', null, B(160), 1, '匈奴谋臣', '汉朝宦官，被迫随公主和亲，到匈奴后转而为单于出谋划策。', { fac: 'xiongnu', e0: B(205), dq: 1 }),
    W('junchen', '军臣单于', 'steppe', null, B(126), 2, '匈奴单于', '老上之子。景帝时与汉和亲、通关市。', { fac: 'xiongnu', e0: B(185), reign: [B(161), B(126)] }),
    // 朝鲜半岛
    W('jun', '准王', 'korea', null, B(190), 1, '古朝鲜国王', '被卫满夺位，传说南逃至韩地。', { e0: B(240), dq: 1 }),
    W('wiman', '卫满', 'korea', null, B(170), 3, '卫满朝鲜开国君主', '燕人，率众东渡，夺取王位，定都王险城。', { e0: B(235), dq: 1 }),
    // 百越
    W('an-duong', '安阳王', 'yue', null, B(179), 1, '瓯雒国君主', '名蜀泮，传说筑古螺城。年代有两说，这里取被南越兼并之说。', { alt: '蜀泮', e0: B(235), dc: 1 }),
    W('zhao-tuo', '赵佗', 'yue', B(240), B(137), 3, '南越武王', '秦朝将领，秦亡后割据岭南自立，在位约六十七年。', { circa: 1, reign: [B(204), B(137)] }),
    // 中国：补一位出使南越的人
    W('lu-jia', '陆贾', 'china', B(240), B(170), 2, '太中大夫', '两度出使南越，说服赵佗归汉；著《新语》。', { fac: 'han', ch: 'xihan', circa: 1 }),
  );

  /* ---------- 事件 ---------- */
  const E = (id, n, lane, s, e, imp, who, sum, x) => Object.assign({ id, n, lane, s, e: e == null ? s : e, imp, who, sum }, x);
  H.events.forEach(e => { e.lane = 'china'; });
  H.events.push(
    E('punic1', '第一次布匿战争', 'rome', B(264), B(241), 4, ['hamilcar'], '罗马与迦太基争夺西西里。罗马获胜，从此成为海上强国。'),
    E('alps', '翻越阿尔卑斯山', 'rome', B(218), null, 3, ['hannibal'], '汉尼拔率军连同战象从西班牙出发，翻山进入意大利。'),
    E('punic2', '第二次布匿战争', 'rome', B(218), B(201), 5, ['hannibal', 'scipio', 'fabius', 'marcellus'], '汉尼拔在意大利转战十余年，罗马最终反攻非洲取胜。'),
    E('cannae', '坎尼会战', 'rome', B(216), null, 4, ['hannibal'], '汉尼拔以两翼包抄，几乎全歼罗马大军。'),
    E('zama', '扎马会战', 'rome', B(202), null, 4, ['hannibal', 'scipio'], '西庇阿在北非击败汉尼拔，战争结束。与垓下之战同年。'),
    E('punic3', '迦太基被毁', 'rome', B(149), B(146), 4, ['aemilianus', 'cato'], '第三次布匿战争。迦太基城被攻陷后夷为平地。'),
    E('syracuse', '叙拉古陷落', 'greece', B(212), null, 3, ['archimedes', 'marcellus'], '罗马围城两年后破城，阿基米德遇害。'),
    E('cynoscephalae', '库诺斯克法莱战役', 'greece', B(197), null, 2, ['philip-v'], '罗马军团击败马其顿方阵，腓力五世退出希腊。'),
    E('pydna', '彼得那战役', 'greece', B(168), null, 4, ['perseus', 'polybius'], '马其顿战败亡国。千名希腊人被送往罗马作人质，波利比乌斯在内。'),
    E('corinth', '科林斯被毁', 'greece', B(146), null, 3, [], '罗马镇压亚该亚同盟，希腊从此归罗马管辖。'),
    E('earth', '测算地球周长', 'egypt', B(240), null, 3, ['eratosthenes'], '埃拉托色尼比较两地正午的日影，算出的周长与实际相差不大。', { circa: 1 }),
    E('raphia', '拉菲亚战役', 'egypt', B(217), null, 3, ['ptolemy-4', 'antiochus-3'], '托勒密四世击败安条克三世，保住了南叙利亚。'),
    E('rosetta', '罗塞塔石碑刻成', 'egypt', B(196), null, 3, ['ptolemy-5'], '祭司为托勒密五世颁布的诏令，用三种文字刻成。'),
    E('parthia', '安息立国', 'meso', B(247), null, 4, ['arsaces', 'antiochus-2'], '阿萨息斯在帕提亚自立。传统上以这一年为安息纪元之始。', { circa: 1 }),
    E('magnesia', '马格尼西亚战役', 'meso', B(190), null, 3, ['antiochus-3'], '罗马击败安条克三世，塞琉古势力退出小亚细亚。'),
    E('seleucia', '安息占领两河', 'meso', B(141), null, 3, ['mithridates-1'], '米特里达梯一世攻取塞琉西亚，两河流域易主。'),
    E('lxx', '七十士译本始译', 'bible', B(250), null, 3, ['ptolemy-2'], '传统说法：应托勒密二世之请，在亚历山大把希伯来经卷译成希腊文。', { circa: 1 }),
    E('desecration', '圣殿遭亵渎', 'bible', B(167), null, 3, ['antiochus-4'], '安条克四世在圣殿设异教祭坛，禁止守律法。'),
    E('maccabee', '马加比起义', 'bible', B(167), B(160), 4, ['mattathias', 'judas', 'jonathan', 'antiochus-4'], '玛他提亚父子起兵，反抗塞琉古的宗教迫害。'),
    E('rededication', '洁净圣殿', 'bible', B(164), null, 3, ['judas'], '犹大收复耶路撒冷，重新献殿，修殿节由此而来。'),
    E('hasmonean', '犹太独立', 'bible', B(142), null, 3, ['simon'], '塞琉古免除贡赋，哈斯蒙尼王朝开始。'),
    E('kalinga', '羯陵伽之战', 'india', B(261), null, 4, ['ashoka'], '阿育王征服羯陵伽，死伤惨重，自述因此悔悟。', { circa: 1 }),
    E('envoys', '阿育王遣使传法', 'india', B(250), null, 3, ['ashoka', 'antiochus-2', 'ptolemy-2'], '石刻诏令记载他向塞琉古、埃及等希腊化王国派出使者。', { circa: 1 }),
    E('maurya-end', '孔雀王朝灭亡', 'india', B(185), null, 3, ['pushyamitra'], '弗沙密多罗杀死末代君主，建立巽伽王朝。', { circa: 1 }),
    E('modu-rise', '冒顿自立', 'steppe', B(209), null, 3, ['modu', 'touman'], '冒顿以鸣镝训练部下，射杀父亲头曼，自立为单于。'),
    E('donghu', '冒顿破东胡', 'steppe', B(206), null, 2, ['modu'], '东袭东胡，西击月氏，南并楼烦，草原归于一统。', { circa: 1 }),
    E('yuezhi', '月氏西迁', 'steppe', B(176), B(161), 3, ['modu', 'laoshang'], '月氏先后被冒顿、老上击败，主体西迁到伊犁河，再到阿姆河流域。', { circa: 1 }),
    E('wiman-joseon', '卫满朝鲜建立', 'korea', B(194), null, 3, ['wiman', 'jun'], '卫满驱逐准王，自立为王。'),
    E('lingnan', '秦征岭南', 'yue', B(214), null, 3, ['ying-zheng', 'zhao-tuo'], '秦军平定百越，设桂林、南海、象郡。'),
    E('nanyue', '南越立国', 'yue', B(204), null, 3, ['zhao-tuo'], '赵佗并有三郡，自立为南越武王。'),
    E('lujia', '陆贾出使南越', 'yue', B(196), null, 2, ['lu-jia', 'zhao-tuo', 'liu-bang'], '赵佗接受汉朝册封。'),
    E('aulac', '南越兼并瓯雒', 'yue', B(179), null, 2, ['zhao-tuo', 'an-duong'], '赵佗的势力伸入红河三角洲。', { circa: 1 }),
  );

  /* ---------- 关系：很多是跨泳道的 ---------- */
  H.rels.push(...[
    ['hamilcar', 'hannibal', 'kin', '父子'], ['hannibal', 'scipio', 'rival', '扎马对决', B(202)],
    ['hannibal', 'fabius', 'rival', '拖延周旋', B(217)], ['hannibal', 'marcellus', 'rival', '伏击致其阵亡', B(208)],
    ['hannibal', 'philip-v', 'ally', '结盟抗罗马', B(215)], ['hannibal', 'antiochus-3', 'ally', '流亡投奔', B(195)],
    ['scipio', 'cato', 'rival', '政敌', B(187)], ['scipio', 'aemilianus', 'kin', '过继之孙'],
    ['aemilianus', 'polybius', 'mentor', '师友', B(167)], ['marcellus', 'archimedes', 'rival', '围攻叙拉古', B(212)],
    ['philip-v', 'perseus', 'kin', '父子'], ['philip-v', 'aratus', 'rival', '先倚重后反目', B(214)],
    ['ptolemy-2', 'ptolemy-3', 'kin', '父子'], ['ptolemy-3', 'ptolemy-4', 'kin', '父子'],
    ['ptolemy-4', 'ptolemy-5', 'kin', '父子'], ['ptolemy-5', 'ptolemy-6', 'kin', '父子'],
    ['ptolemy-3', 'eratosthenes', 'lord', '聘为馆长', B(245)], ['ptolemy-4', 'antiochus-3', 'rival', '拉菲亚之战', B(217)],
    ['ptolemy-5', 'antiochus-3', 'kin', '翁婿', B(193)], ['ptolemy-6', 'antiochus-4', 'rival', '两度入侵埃及', B(169)],
    ['ashoka', 'antiochus-2', 'ally', '遣使', B(256)], ['ashoka', 'ptolemy-2', 'ally', '遣使', B(254)],
    ['antiochus-2', 'arsaces', 'rival', '脱离自立', B(247)], ['antiochus-3', 'antiochus-4', 'kin', '父子'],
    ['antiochus-4', 'onias-3', 'rival', '罢黜', B(175)], ['antiochus-4', 'mattathias', 'rival', '起兵反抗', B(167)],
    ['antiochus-4', 'judas', 'rival', '起兵反抗', B(165)], ['mattathias', 'judas', 'kin', '父子'],
    ['mattathias', 'simon', 'kin', '父子'], ['judas', 'jonathan', 'kin', '兄弟，继任', B(160)],
    ['jonathan', 'simon', 'kin', '兄弟，继任', B(143)],
    ['touman', 'modu', 'kin', '父子，弑父', B(209)], ['modu', 'laoshang', 'kin', '父子'], ['laoshang', 'junchen', 'kin', '父子'],
    ['modu', 'lv-zhi', 'rival', '致书相辱', B(192)], ['laoshang', 'liu-heng', 'rival', '大举入塞', B(166)],
    ['laoshang', 'zhonghang-yue', 'lord', '重用', B(173)], ['zhonghang-yue', 'liu-heng', 'rival', '叛汉', B(174)],
    ['junchen', 'liu-qi', 'ally', '和亲', B(156)],
    ['wiman', 'jun', 'rival', '夺位', B(194)], ['wiman', 'liu-ying', 'lord', '约为外臣', B(192)],
    ['zhao-tuo', 'ying-zheng', 'lord', '秦将', B(214)], ['zhao-tuo', 'liu-bang', 'lord', '受封南越王', B(196)],
    ['zhao-tuo', 'lv-zhi', 'rival', '交恶称帝', B(183)], ['zhao-tuo', 'liu-heng', 'lord', '去帝号归汉', B(179)],
    ['zhao-tuo', 'lu-jia', 'ally', '两度出使', B(195)], ['zhao-tuo', 'an-duong', 'rival', '兼并瓯雒', B(180)],
    ['lu-jia', 'liu-bang', 'lord', '君臣', B(200)], ['lu-jia', 'chen-ping', 'ally', '同谋诛吕', B(181)],
  ].map(([a, b, t, label, year]) => ({ a, b, t, label, year })));

  H.reg();
})();
