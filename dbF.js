module.exports = {
  addWord: (db, wordObj) => {
    const { word, definition, example=undefined } = wordObj;
    db.prepare(`INSERT INTO words VALUES (?, ?, ?)`)
      .run(word, definition, example);
    return;
  },

  removeDefinition: (db, definition) => {
    const stmt = db.prepare(`DELETE FROM words WHERE definition = ?`);
    stmt.run(definition);
  },

  clearWords: (db) => {
    const stmt = db.prepare(`DELETE FROM words WHERE 1=1`);
    stmt.run();
  },

  getUniqueWords: db => {
    const stmt = db.prepare('SELECT DISTINCT word FROM words');
    return stmt.all();
  },

  getWordDefinitions: (db, word) => {
    const stmt = db.prepare(`SELECT * FROM words WHERE word = ?`);
    return stmt.all(word);
  },
  
  // Dev
  listWords: (db) => {
    // Lists all words in the db on the console
    const stmt = db.prepare(`SELECT * FROM words`);
    console.log(stmt.all());
  }
}
