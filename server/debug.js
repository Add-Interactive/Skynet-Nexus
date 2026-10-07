// Debug test-group endpoints — bulk seed, activity stats, and gated reset.
// All endpoints require the x-debug-key header (or ?key=) matching process.env.DEBUG_KEY.
// If DEBUG_KEY is not set, every endpoint 404s.
const { hashPassword } = require('./auth');
const { syncChatMembers } = require('./chat');

const DEBUG_PASSWORD = 'DebugTest123!';

const KID_FIRST = ['Ava','Liam','Mia','Noah','Zoe','Eli','Ivy','Kai','Luna','Milo','Nora','Owen','Piper','Quinn','Ruby','Silas','Tessa','Umar','Vera','Wren','Xander','Yara','Zane','Ada','Bodhi','Cleo','Dax','Esme','Finn','Greta','Hugo','Isla','Jude','Kira','Leo','Maya','Nico','Opal','Pax','Rhea','Sage','Theo','Uma','Viggo','Willa','Ximena','Yusuf','Zola','Amara','Beck','Calla','Dante','Elif','Flora','Gus','Hana','Iker','Juno','Koda','Lena','Marco','Nia','Orson','Paloma','Ravi','Sana','Tariq','Ulani','Vesper','Wilder','Xavi','Yuki','Zara','Alba','Brio','Ciel','Dov','Elka','Farah','Gideon','Hollis','Indie','Jasper','Kehlani','Lior','Marisol','Nash','Odette','Pilar','Remy','Suki','Tomas','Una','Vada','Wynn','Xochitl','Yanis','Zelda'];
const PARENT_FIRST = ['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Christopher','Nancy','Daniel','Lisa','Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley','Steven','Kimberly','Paul','Emily','Andrew','Donna','Joshua','Michelle','Kenneth','Carol','Kevin','Amanda','Brian','Dorothy','George','Melissa','Timothy','Deborah','Ronald','Stephanie','Edward','Rebecca','Jason','Sharon','Jeffrey','Laura','Ryan','Cynthia','Jacob','Kathryn','Gary','Amy','Nicholas','Shirley','Eric','Angela','Jonathan','Helen','Stephen','Anna','Larry','Brenda','Justin','Pamela','Scott','Nicole','Brandon','Emma','Benjamin','Samantha','Samuel','Katherine','Gregory','Christine','Alexander','Debra','Frank','Rachel','Raymond','Carolyn','Jack','Janet','Dennis','Maria','Walter','Olivia','Patrick','Heather','Peter','Diane'];
const PARENT_LAST = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts'];
const TEACHER_NAMES = ['Debug Teacher Rosa', 'Debug Teacher Chen', 'Debug Teacher Okafor'];
const CLASS_NAMES = ['Debug Class Aurora', 'Debug Class Beacon', 'Debug Class Comet'];
const AVATAR_COLORS = ['#00e5ff','#39ff14','#ff2e63','#ffd23f','#a855f7','#ff9f1c','#4cc9f0','#f72585'];
const AVATAR_EMOJIS = ['🚀','🦕','🌟','🎨','⚽','🐱','🦄','🤖','🌈','🍕','🐙','🦖','🎸','🌙','⚡','🍩'];

function registerDebug(api) {
  const checkKey = (req, res, next) => {
    const KEY = process.env.DEBUG_KEY;
    if (!KEY) return res.status(404).json({ error: 'not found' });
    const k = req.headers['x-debug-key'] || (req.body && req.body.key) || req.query.key;
    if (k !== KEY) return res.status(403).json({ error: 'forbidden' });
    next();
  };

  // ---- POST /api/debug/seed — build the full test population ----
  api.post('/debug/seed', checkKey, async (req, res) => {
    try {
      const { db, createKid } = require('./db');
      const group = String((req.body && req.body.group) || 'week1').slice(0, 24) || 'week1';
      const existing = db.prepare('SELECT COUNT(*) as n FROM users WHERE debug_group = ?').get(group).n;
      if (existing > 0) return res.status(409).json({ error: 'group already seeded', group, users: existing });

      const passwordHash = await hashPassword(DEBUG_PASSWORD);
      const manifest = { group, teachers: [], families: [], classrooms: [], userCount: 0, kidCount: 0 };
      const mkUser = db.prepare(`INSERT INTO users (email, display_name, password_hash, avatar_color, role, debug_group) VALUES (?,?,?,?,?,?)`);

      db.exec('BEGIN');
      try {
        // 3 teachers
        const teacherIds = [];
        TEACHER_NAMES.forEach((name, i) => {
          const r = mkUser.run(`debug-teacher-${i + 1}@skynetnexus.test`, name, passwordHash,
            AVATAR_COLORS[i % AVATAR_COLORS.length], 'teacher', group);
          teacherIds.push(r.lastInsertRowid);
          manifest.teachers.push({ id: r.lastInsertRowid, name, email: `debug-teacher-${i + 1}@skynetnexus.test` });
        });

        // 50 families × (2 parents + 2 kids) + 6 grandparents on families 1-6
        const kidIds = [];
        const genCode = () => Array.from({ length: 8 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
        for (let f = 0; f < 50; f++) {
          const famName = `Debug Family ${String(f + 1).padStart(2, '0')}`;
          const code = genCode();
          const p1 = f * 2, p2 = f * 2 + 1;
          const last = PARENT_LAST[f % PARENT_LAST.length];
          const parent1 = `${PARENT_FIRST[p1 % PARENT_FIRST.length]} ${last}`;
          const parent2 = `${PARENT_FIRST[p2 % PARENT_FIRST.length]} ${last}`;
          const u1 = mkUser.run(`debug-parent-${String(p1 + 1).padStart(3, '0')}@skynetnexus.test`, parent1, passwordHash,
            AVATAR_COLORS[p1 % AVATAR_COLORS.length], 'parent', group).lastInsertRowid;
          const u2 = mkUser.run(`debug-parent-${String(p2 + 1).padStart(3, '0')}@skynetnexus.test`, parent2, passwordHash,
            AVATAR_COLORS[p2 % AVATAR_COLORS.length], 'parent', group).lastInsertRowid;
          const fam = db.prepare('INSERT INTO families (name, created_by, invite_code) VALUES (?,?,?)').run(famName, u1, code).lastInsertRowid;
          const mkMember = db.prepare('INSERT INTO family_members (family_id, user_id, relationship, invited_by) VALUES (?,?,?,?)');
          mkMember.run(fam, u1, 'parent', u1);
          mkMember.run(fam, u2, 'spouse', u1);
          // grandparent on first 6 families
          let gpId = null;
          if (f < 6) {
            gpId = mkUser.run(`debug-grandparent-${f + 1}@skynetnexus.test`, `Grandparent ${PARENT_FIRST[(f * 7) % PARENT_FIRST.length]} ${last}`,
              passwordHash, AVATAR_COLORS[(f + 3) % AVATAR_COLORS.length], 'parent', group).lastInsertRowid;
            mkMember.run(fam, gpId, 'grandparent', u1);
          }
          const kids = [];
          for (let k = 0; k < 2; k++) {
            const idx = f * 2 + k;
            const kid = createKid({
              userId: k % 2 === 0 ? u1 : u2,
              name: KID_FIRST[idx % KID_FIRST.length],
              birthYear: 2015 + (idx % 6),
              avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
              avatarEmoji: AVATAR_EMOJIS[idx % AVATAR_EMOJIS.length],
              correspondentStyle: 'human',
            });
            kidIds.push(kid.id);
            kids.push({ id: kid.id, name: kid.name });
            // ensure settings row exists
            db.prepare('INSERT OR IGNORE INTO kid_settings (kid_id) VALUES (?)').run(kid.id);
          }
          try { syncChatMembers(db, 'family', fam); } catch (e) {}
          manifest.families.push({ id: fam, name: famName, inviteCode: code, parents: [u1, u2], grandparent: gpId, kids });
        }

        // 3 classrooms — 34/33/33 kids, one teacher each
        const mkClass = db.prepare('INSERT INTO classrooms (user_id, name) VALUES (?,?)');
        const mkStudent = db.prepare('INSERT OR IGNORE INTO classroom_students (classroom_id, kid_id) VALUES (?,?)');
        [34, 33, 33].forEach((count, ci) => {
          const cls = mkClass.run(teacherIds[ci], CLASS_NAMES[ci]).lastInsertRowid;
          const slice = kidIds.slice(ci === 0 ? 0 : ci === 1 ? 34 : 67, ci === 0 ? 34 : ci === 1 ? 67 : 100);
          slice.forEach(kidId => mkStudent.run(cls, kidId));
          try { syncChatMembers(db, 'classroom', cls); } catch (e) {}
          manifest.classrooms.push({ id: cls, name: CLASS_NAMES[ci], teacherId: teacherIds[ci], kidCount: slice.length });
        });

        manifest.userCount = db.prepare('SELECT COUNT(*) as n FROM users WHERE debug_group = ?').get(group).n;
        manifest.kidCount = kidIds.length;
        db.exec('COMMIT');
      } catch (txErr) {
        try { db.exec('ROLLBACK'); } catch (e) {}
        throw txErr;
      }

      res.status(201).json({ ok: true, manifest, password: DEBUG_PASSWORD });
    } catch (e) {
      console.error('[debug/seed]', e.message);
      res.status(500).json({ error: 'seed failed: ' + e.message });
    }
  });

  // ---- POST /api/debug/reset — delete the whole test population (gated) ----
  api.post('/debug/reset', checkKey, (req, res) => {
    try {
      const { db } = require('./db');
      const group = String((req.body && req.body.group) || 'week1').slice(0, 24) || 'week1';
      const confirm = String((req.body && req.body.confirm) || '');
      if (confirm !== `DELETE-DEBUG-${group}`) {
        return res.status(400).json({ error: `confirmation required: pass confirm="DELETE-DEBUG-${group}"` });
      }
      const userIds = db.prepare('SELECT id FROM users WHERE debug_group = ?').all(group).map(r => r.id);
      if (!userIds.length) return res.json({ ok: true, deleted: 0, group });
      const kidIds = db.prepare(`SELECT id FROM kid_profiles WHERE user_id IN (${userIds.map(() => '?').join(',')})`).all(...userIds).map(r => r.id);
      const famIds = db.prepare(`SELECT id FROM families WHERE created_by IN (${userIds.map(() => '?').join(',')})`).all(...userIds).map(r => r.id);
      const classIds = db.prepare(`SELECT id FROM classrooms WHERE user_id IN (${userIds.map(() => '?').join(',')})`).all(...userIds).map(r => r.id);
      const counts = {};

      const ph = ids => ids.map(() => '?').join(',');
      db.exec('BEGIN');
      try {
        // chat spaces tied to debug families/classrooms
        if (famIds.length) {
          counts.chatSpacesFamily = db.prepare(`DELETE FROM chat_spaces WHERE type='family' AND ref_id IN (${ph(famIds)})`).run(...famIds).changes;
          counts.chatMembersFam = 0;
        }
        if (classIds.length) {
          counts.chatSpacesClass = db.prepare(`DELETE FROM chat_spaces WHERE type='classroom' AND ref_id IN (${ph(classIds)})`).run(...classIds).changes;
        }
        // dynamic sweep: any table with user_id / kid_id columns
        const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all().map(r => r.name);
        for (const t of tables) {
          let cols = [];
          try { cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name); } catch (e) { continue; }
          if (t === 'users') continue;
          try {
            if (cols.includes('user_id') && userIds.length) {
              const n = db.prepare(`DELETE FROM ${t} WHERE user_id IN (${ph(userIds)})`).run(...userIds).changes;
              if (n) counts[t + ':user_id'] = (counts[t + ':user_id'] || 0) + n;
            }
            if (cols.includes('kid_id') && kidIds.length) {
              const n = db.prepare(`DELETE FROM ${t} WHERE kid_id IN (${ph(kidIds)})`).run(...kidIds).changes;
              if (n) counts[t + ':kid_id'] = (counts[t + ':kid_id'] || 0) + n;
            }
          } catch (e) { /* column type mismatch or FK — skip */ }
        }
        // families / classrooms / kids / users
        if (famIds.length) {
          db.prepare(`DELETE FROM family_members WHERE family_id IN (${ph(famIds)})`).run(...famIds);
          counts.families = db.prepare(`DELETE FROM families WHERE id IN (${ph(famIds)})`).run(...famIds).changes;
        }
        if (classIds.length) {
          db.prepare(`DELETE FROM classroom_students WHERE classroom_id IN (${ph(classIds)})`).run(...classIds);
          counts.classrooms = db.prepare(`DELETE FROM classrooms WHERE id IN (${ph(classIds)})`).run(...classIds).changes;
        }
        if (kidIds.length) counts.kids = db.prepare(`DELETE FROM kid_profiles WHERE id IN (${ph(kidIds)})`).run(...kidIds).changes;
        counts.users = db.prepare(`DELETE FROM users WHERE id IN (${ph(userIds)})`).run(...userIds).changes;
        // leftover chat messages/members orphaned by space deletes
        try {
          const spaces = db.prepare(`SELECT id FROM chat_spaces`).all().map(r => r.id);
          if (spaces.length) {
            db.prepare(`DELETE FROM chat_messages WHERE space_id NOT IN (${ph(spaces)})`).run(...spaces);
            db.prepare(`DELETE FROM chat_members WHERE space_id NOT IN (${ph(spaces)})`).run(...spaces);
          } else {
            db.prepare(`DELETE FROM chat_messages`).run();
            db.prepare(`DELETE FROM chat_members`).run();
          }
        } catch (e) {}
        db.exec('COMMIT');
      } catch (txErr) {
        try { db.exec('ROLLBACK'); } catch (e) {}
        throw txErr;
      }
      res.json({ ok: true, group, deletedUsers: userIds.length, counts });
    } catch (e) {
      console.error('[debug/reset]', e.message);
      res.status(500).json({ error: 'reset failed: ' + e.message });
    }
  });

  // ---- GET /api/debug/manifest — full test-population structure for the dashboard ----
  api.get('/debug/manifest', checkKey, (req, res) => {
    try {
      const { db } = require('./db');
      const group = String(req.query.group || 'week1').slice(0, 24) || 'week1';
      const users = db.prepare(`SELECT id, email, display_name, role FROM users WHERE debug_group = ?`).all(group);
      const byId = Object.fromEntries(users.map(u => [u.id, u]));
      const kids = db.prepare(`SELECT k.id, k.user_id, k.name, k.birth_year FROM kid_profiles k
        JOIN users u ON u.id = k.user_id WHERE u.debug_group = ?`).all(group);
      const families = db.prepare(`SELECT f.id, f.name, f.invite_code FROM families f
        WHERE f.created_by IN (SELECT id FROM users WHERE debug_group = ?) ORDER BY f.id`).all(group);
      const famOut = families.map(f => {
        const members = db.prepare(`SELECT user_id, relationship FROM family_members WHERE family_id = ?`).all(f.id)
          .map(m => ({ id: m.user_id, name: (byId[m.user_id] || {}).display_name || '?', email: (byId[m.user_id] || {}).email || '?', relationship: m.relationship }));
        const fkids = kids.filter(k => members.some(m => m.id === k.user_id))
          .map(k => ({ id: k.id, name: k.name, birthYear: k.birth_year, parentId: k.user_id }));
        return { id: f.id, name: f.name, inviteCode: f.invite_code, members, kids: fkids };
      });
      const classrooms = db.prepare(`SELECT c.id, c.name, c.user_id FROM classrooms c
        WHERE c.user_id IN (SELECT id FROM users WHERE debug_group = ?) ORDER BY c.id`).all(group);
      const clsOut = classrooms.map(c => {
        const studentIds = db.prepare(`SELECT kid_id FROM classroom_students WHERE classroom_id = ?`).all(c.id).map(r => r.kid_id);
        const students = kids.filter(k => studentIds.includes(k.id)).map(k => ({ id: k.id, name: k.name }));
        const t = byId[c.user_id] || {};
        return { id: c.id, name: c.name, teacher: { id: c.user_id, name: t.display_name || '?', email: t.email || '?' }, students };
      });
      const teachers = users.filter(u => u.role === 'teacher').map(u => ({ id: u.id, name: u.display_name, email: u.email }));
      res.json({ group, teachers, families: famOut, classrooms: clsOut,
        counts: { users: users.length, kids: kids.length, families: famOut.length, classrooms: clsOut.length } });
    } catch (e) {
      console.error('[debug/manifest]', e.message);
      res.status(500).json({ error: 'manifest failed: ' + e.message });
    }
  });

  // ---- GET /api/debug/stats — activity stats for the nightly report ----
  api.get('/debug/stats', checkKey, (req, res) => {
    try {
      const { db } = require('./db');
      const group = String(req.query.group || 'week1').slice(0, 24) || 'week1';
      const days = Math.min(14, Number(req.query.days) || 7);
      const userIds = db.prepare('SELECT id FROM users WHERE debug_group = ?').all(group).map(r => r.id);
      if (!userIds.length) return res.json({ group, users: 0, days: [] });
      const kidIds = db.prepare(`SELECT id, user_id FROM kid_profiles WHERE user_id IN (${userIds.map(() => '?').join(',')})`).all(...userIds);
      const kidIdList = kidIds.map(k => k.id);
      const dayRows = [];
      const q = (sql, ...a) => { try { return db.prepare(sql).get(...a); } catch (e) { return {}; } };
      const qa = (sql, ...a) => { try { return db.prepare(sql).all(...a); } catch (e) { return []; } };
      for (let d = 0; d < days; d++) {
        const date = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
        const like = date + '%';
        const stories = kidIdList.length ? q(`SELECT COUNT(*) as n FROM kid_xp_events WHERE kid_id IN (${kidIdList.map(() => '?').join(',')}) AND event_type='story' AND created_at LIKE ?`, ...kidIdList, like).n || 0 : 0;
        const quizzes = kidIdList.length ? q(`SELECT COUNT(*) as n FROM quiz_attempts WHERE kid_id IN (${kidIdList.map(() => '?').join(',')}) AND created_at LIKE ?`, ...kidIdList, like).n || 0 : 0;
        const chats = q(`SELECT COUNT(*) as n FROM chat_messages WHERE (user_id IN (${userIds.map(() => '?').join(',')})${kidIdList.length ? ` OR kid_id IN (${kidIdList.map(() => '?').join(',')})` : ''}) AND created_at LIKE ?`, ...userIds, ...(kidIdList.length ? kidIdList : []), like).n || 0;
        const replies = kidIdList.length ? q(`SELECT COUNT(*) as n FROM discussion_replies WHERE author_kid_id IN (${kidIdList.map(() => '?').join(',')}) AND created_at LIKE ?`, ...kidIdList, like).n || 0 : 0;
        const feedback = q(`SELECT COUNT(*) as n FROM beta_feedback WHERE user_id IN (${userIds.map(() => '?').join(',')}) AND created_at LIKE ?`, ...userIds, like).n || 0;
        const xp = kidIdList.length ? q(`SELECT COALESCE(SUM(xp),0) as s FROM kid_xp_events WHERE kid_id IN (${kidIdList.map(() => '?').join(',')}) AND created_at LIKE ?`, ...kidIdList, like).s || 0 : 0;
        dayRows.push({ date, stories, quizzes, chats, replies, feedback, xp });
      }
      const top = qa(`SELECT u.display_name as name, u.email as email, COUNT(e.id) as events
        FROM users u LEFT JOIN kid_profiles k ON k.user_id = u.id LEFT JOIN kid_xp_events e ON e.kid_id = k.id
        WHERE u.debug_group = ? GROUP BY u.id ORDER BY events DESC LIMIT 10`, group);
      // Per-classroom activity for the dashboard's classroom comparison section.
      // All-time counts (not per-day): discussions + replies + enrolled students.
      const debugClassrooms = qa(`SELECT id, name FROM classrooms WHERE user_id IN (SELECT id FROM users WHERE debug_group = ?) ORDER BY id`, group);
      const classroomActivity = debugClassrooms.map(c => {
        const discussions = q(`SELECT COUNT(*) as n FROM discussions WHERE classroom_id = ?`, c.id).n || 0;
        const replies = q(`SELECT COUNT(*) as n FROM discussion_replies WHERE discussion_id IN (SELECT id FROM discussions WHERE classroom_id = ?)`, c.id).n || 0;
        const studentCount = q(`SELECT COUNT(*) as n FROM classroom_students WHERE classroom_id = ?`, c.id).n || 0;
        return { classroomId: c.id, name: c.name, discussions, replies, studentCount };
      });
      res.json({
        group, users: userIds.length, kids: kidIdList.length,
        families: db.prepare(`SELECT COUNT(*) as n FROM families WHERE created_by IN (${userIds.map(() => '?').join(',')})`).get(...userIds).n || 0,
        classrooms: db.prepare(`SELECT COUNT(*) as n FROM classrooms WHERE user_id IN (${userIds.map(() => '?').join(',')})`).get(...userIds).n || 0,
        days: dayRows, topActive: top, classroomActivity,
      });
    } catch (e) {
      console.error('[debug/stats]', e.message);
      res.status(500).json({ error: 'stats failed: ' + e.message });
    }
  });
}

module.exports = { registerDebug };
