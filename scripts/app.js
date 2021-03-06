const fs = require('fs');

// Create folder for DB if doesn't exists
if (!fs.existsSync(`${__dirname}/db`)) {
    fs.mkdir(`${__dirname}/db`, err => {
        if (err) throw new Error(err);
    });
};

const { ipcRenderer } = require('electron');
const Database = require('better-sqlite3');
const db = new Database('./db/dictionary.db');
const { getUniqueWords, addWord, clearWords, getWordDefinitions, getMatchingWords, deleteDefinition, deleteWord } = require('./dbF');
const VERSION = "1.2.0";

// DB
db.prepare(`
    CREATE TABLE IF NOT EXISTS words(
        word TEXT NOT NULL,
        definition TEXT NOT NULL UNIQUE,
        example TEXT
    );
`).run();

class App {
    constructor() {
        this.state = {
            $minimizeButton: document.getElementById('minimize-button'),
            $closeButton: document.getElementById('close-button'),
            $changeThemeButton: document.getElementById('changetheme-button'),
            $searchBar: document.getElementById('searchbar'),
            $resultContainer: document.getElementById('search-result'),
            $aboutModal: document.getElementById('about-modal'),
            $notificationContainer: document.querySelector('.notification-container'),
            $savedWordsContainer: document.querySelector('.saved-words-container'),
            $savedWordsButton: document.querySelector('#saved-words-button'),
            $savedWordsContent: document.querySelector('#saved-words-content'),
            $savedWordsTitleContainer: document.querySelector('.saved-words-title-container'),
            $savedWordsTitle: document.querySelector('#saved-words-title'),
            $searchSavedWordsInput: document.querySelector('.search-saved-words-input'),

            searchQuery: '',
            searchSavedWordQuery: '',
            currentTheme: document.getElementById('theme-link'),
            currentWord: '',
            currentOpenedSavedWord: "",
            savedWordsOpened: false,
            hasSavedWord: false,
            isInDefinition: false,
            currentNotificationHandler: undefined
        }
        this.setVersion(VERSION);
        this.addListeners();
    }

    setVersion(version) {
        document.querySelector('#version').innerHTML = "JSTionary " + version;
    }

    addListeners() {
        /// SearchBar
        this.state.$searchBar.addEventListener('keypress', function(e) {
            if (e.charCode === 13) {
                this.searchWord(this.state.$searchBar.value);
                this.state.$searchBar.value = "";
            }
        }.bind(this))

        this.state.$searchBar.addEventListener('focus', function() {
            this.value = ""
        });

        /// SearchSavedWord
        this.state.$searchSavedWordsInput.addEventListener('input', e => {
                this.displaySavedWords(e.target.value);
        })

        /// Modal 
        document.querySelector("#about").addEventListener('click', function() {
            (() => {
                if(this.containsClass(this.state.$aboutModal.classList, 'hide')) {
                    this.state.$aboutModal.classList.remove('hide');
                    this.state.$aboutModal.style.display = "block";
                    return;
                }
                this.state.$aboutModal.classList.add('hide');
                this.state.$aboutModal.style.display = "none";
            })();
            //this.state.$aboutModal.classList.remove('hide');
            //this.state.$aboutModal.style.display = "block";
        }.bind(this));

        // Toggle Saved Words Button
        this.state.$savedWordsButton.addEventListener('click', this.toggleSavedWords);

        // Minimize App Button
        this.state.$minimizeButton.addEventListener('click', function() {
            ipcRenderer.send('minimize-app');
        })

        // Close App Button
        this.state.$closeButton.addEventListener('click', function() {
            ipcRenderer.send('close-app');
        })

        // Close Modal Button
        document.querySelector('.close').onclick = function() {
            this.state.$aboutModal.style.display = "none";
        }.bind(this);

        // Close modal on outisde click
        window.onclick = function(event) {
            if (event.target == this.state.$aboutModal) {
                this.state.$aboutModal.style.display = 'none';
            }
        }.bind(this)

        /// Theme Switch
        this.state.$changeThemeButton.addEventListener('click', function() {
            if (this.state.currentTheme.getAttribute('href') === './styles/light-theme.css') {
                window.localStorage.setItem('theme', 'dark-theme');
                this.state.currentTheme.setAttribute('href', './styles/dark-theme.css');
                document.querySelector('.dark-enabled').classList.remove('dark-disabled');
            } else {
                window.localStorage.setItem('theme', 'light-theme');
                this.state.currentTheme.setAttribute('href', './styles/light-theme.css');
                document.querySelector('.dark-enabled').classList.add('dark-disabled')

            }
        }.bind(this))
    }

    searchWord(word) {
        if (!word) {
            this.displayError(true);
            return;
        }

        this.displayLoading();
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/es/${word}`)
            .then(resp => resp.json())
            .then(data => {
                this.state.currentWord = word;
                this.displayResult(data[0]);
                this.state.$searchBar.scrollIntoView();
            })
            .catch(() => this.displayError());
    }

    addListenersToDefinitions() {
        const definitions = document.querySelectorAll('.definition');
        for(let i = 0; i < definitions.length; i++) {
            definitions[i].addEventListener('click', function() {
                const r = document.createRange();
                r.selectNodeContents(this);
                let sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(r);
                document.execCommand('Copy');
                new Notification('Definicion copiada!', { body: `La definicion de ${this.id} se copi?? al portapapeles` })
            })
        }
    }

    displayResult(result) {
        const formatedResults = result.meanings[0].definitions.map(definition => `
            <div class="definition-container" id="${definition.definition}">
                <p class="definition" id="${result.word}">
                    ${definition.definition}
                </p>
                ${definition.example ? `
                    <span class="definition-example" id="${definition.example}">
                        "${definition.example}"
                    </span>
                ` : '<div style="display: none"></div>'
                }
                <div class="definition-button-container">
                    <button class="definition-button">Guardar</button>
                </div>
            </div>
        `);

        this.state.$resultContainer.innerHTML = `
            <div class="result hide">
                <h3 class="word" style="${result.word.length > 14 ? 'font-size: 3em' : 'font-size: 4em'}">${result.word}</h3>
                <h4>${result.meanings[0].definitions.length > 1 ? 'Significados' : 'Signficado'}</h4>
                ${formatedResults.map(result => {
                    return result;
                }).join('')}
                <a class="search-again" href="#">Buscar otra palabra</a>
            </div>
        `
        
        this.state.$resultContainer.scrollIntoView();
        document.querySelector('.result').classList.remove('hide');
        this.addListenersToDefinitions();
        this.addSearchAgainListener();
        this.addSaveButtonListener();
    }

    displayError(wasEmptyInput) {
        if (wasEmptyInput) {
            this.state.$resultContainer.innerHTML = `
            <div class="error-container hide">
                <span class="error">Debes escribir una palabra para buscar.</span>
                <ul class="error-motives">
                    <li>Verifique que haya estado escribiendo en el cuadro de b??squeda</li>
                </ul>
            </div>
            `
            this.state.$resultContainer.scrollIntoView();
            document.querySelector('.error-container').classList.remove('hide');
        } else {
            this.state.$resultContainer.innerHTML = `
            <div class="error-container hide">
                <span class="error">Ha ocurrido un error</span>
                <ul class="error-motives">
                    <li>Asegurese de haber escrito bien la palabra</li>
                    <li>Verifique que tengas conexi??n a internet</li>
                </ul>
                <a class="search-again" href="#">Intentalo denuevo</a>
            </div>
            `
            this.state.$resultContainer.scrollIntoView();
            document.querySelector('.error-container').classList.remove('hide');
            this.addSearchAgainListener();
        }
    }

    displayNotification(notificationObject, notificationTime=2000) {
        if (this.state.currentNotificationHandler) return;
        if (notificationObject.error) {
            this.state.$notificationContainer.classList.add('notification-error');
            document.querySelector('#notification-content').innerHTML = `
                ${notificationObject.message}
            `
            this.state.currentNotificationHandler = setTimeout(() => {
                this.state.$notificationContainer.classList.remove('notification-error');
                this.state.currentNotificationHandler = undefined;
            }, notificationTime);
            return;
        }
        this.state.$notificationContainer.classList.add('notification-success');
        document.querySelector('#notification-content').innerHTML = `
            ${notificationObject.message}
        `

        this.state.currentNotificationHandler = setTimeout(() => {
            this.state.$notificationContainer.classList.remove('notification-success');
            this.state.currentNotificationHandler = undefined;
        }, notificationTime);
    }

    displaySavedWords = wordQuery => {
        const { $savedWordsContent, savedWordsOpened } = this.state;
        if (!wordQuery) {
            if (!savedWordsOpened) this.state.savedWordsOpened = true;

            const words = getUniqueWords(db);
            if (!words.length) {
                $savedWordsContent.innerHTML = `
                    <p class="result-placeholder">No tienes palabras guardadas.</p>
                `
                return;
            }
            const filteredWords = words.map(({word}) => `<p class="saved-word">${word}</p>`).join('');
            $savedWordsContent.innerHTML = `
                    ${filteredWords}
            `;

            this.addListenersToSavedWords();
            return;
        }
        const words = getMatchingWords(db, wordQuery.toLowerCase());
        if (!words.length) {
            $savedWordsContent.innerHTML = `
                <p class="result-placeholder">No tienes palabras que concuerden con tu b??squeda</p>
            `
            return;
        }
        const filteredWords = words.map(({word}) => `<p class="saved-word">${word}</p>`).join('');
        $savedWordsContent.innerHTML = `
            ${filteredWords}
        `
        this.addListenersToSavedWords();
    }

    addListenersToSavedWords() {
        document.querySelectorAll('.saved-word').forEach(savedWord => {
            savedWord.addEventListener('click', event => {
                this.state.currentOpenedSavedWord = event.target.innerText;
                this.state.isInDefinition = true;
                this.displaySavedWord(event.target.innerText);
            })
        })
    }

    deleteCurrentWord() {
        const { currentOpenedSavedWord } = this.state;
        try {
            deleteWord(db, currentOpenedSavedWord);
        } catch(e) {
            this.displayNotification({ error: true, message: "Algo sali?? mal" });
            return;
        }
        this.displayNotification({ message: `Palabra ${currentOpenedSavedWord} eliminada` });
        this.resetSavedWordsTitle();
        this.displaySavedWords();
    }

    addListenersToDeleteButtons() {
        document.querySelectorAll('.btn-del').forEach(button => button.addEventListener('click', e => {
            try {
                deleteDefinition(db, e.target.parentElement.parentElement.childNodes[1].innerText);
            } catch(e) {
                this.displayNotification({ error: true, message: "No se pudo eliminar la definici??n" });
                return;
            }

            if (!getWordDefinitions(db, this.state.currentOpenedSavedWord).length) {
                this.resetSavedWordsTitle();
                this.displaySavedWords();
                this.displayNotification({ message: `Se elimin?? la palabra ${this.state.currentOpenedSavedWord}` }, 3000);
                return;
            }
            
            this.displayNotification({ message: "Definicion eliminada correctamente" });
            this.displaySavedWord(this.state.currentOpenedSavedWord);
        }));

        document.querySelector('.delete-button').addEventListener('click', () => {
            this.deleteCurrentWord();
        })
    }

    displaySavedWord(word) {
        const { $savedWordsContent, $savedWordsTitleContainer, $searchSavedWordsInput } = this.state;
        // Hide searchbar
        $searchSavedWordsInput.style.display = "none";
        const definitions = getWordDefinitions(db, word);
        const filteredDefinitions = definitions.map(definition => `
            <div class="definition-container">
                <p class="definition" id="${word}">${definition.definition}</p>
                ${definition.example ? `<span class="definition-example">"${definition.example}"</span>` : `<div style="display: none"></div>`}
                <div class="definition-button-container">
                    <button class="definition-button btn-del">Eliminar</button>
                </div>
            </div>
        `).join('');

        $savedWordsTitleContainer.innerHTML = `
        <div class="title-container">
            <div class="title-button-container">
                <h3 class="saved-words-back-button">< Atr??s</h3>
                <h3 class="search-again-button">M??s definiciones</h3>
                <h3 class="delete-button">Eliminar <br>palabra</h3>
            </div>
            <h3 class="saved-words-title" id="saved-words-title">${word}</h3>
        </div>
        `;

        // Reset
        this.state.$savedWordsTitle = document.querySelector('#saved-words-title');

        $savedWordsContent.innerHTML = `
            <div class="saved-definitions-container">               
                ${filteredDefinitions}
            </div>
        `;
        this.addListenersToDefinitions();

        // Add listener to back button.
        document.querySelector('.saved-words-back-button').addEventListener('click', () => {
            this.state.currentOpenedSavedWord = undefined;
            this.state.isInDefinition = false;
            $searchSavedWordsInput.style.display = "block";
            this.resetSavedWordsTitle();
            this.displaySavedWords();
        });

        // Add listener to delete buttons
        this.addListenersToDeleteButtons();
        // Reset search input
        this.state.$searchSavedWordsInput.value = '';

        // Add listener to search again buttons
            document.querySelector('.search-again-button').addEventListener('click', () => {
                if (this.state.currentOpenedSavedWord === this.state.currentWord) {
                    this.toggleSavedWords();
                    this.state.$searchBar.scrollIntoView();
                    return;
                }
                this.toggleSavedWords();
                this.searchWord(this.state.currentOpenedSavedWord);
            })
        }

    resetSavedWordsTitle() {
        const { $savedWordsTitleContainer } = this.state;
        this.state.isInDefinition = false;
        this.state.currentOpenedSavedWord = undefined;
            const currentTitle = document.querySelector('#saved-words-title');
                if (currentTitle.innerText !== 'Palabras guardadas') {
                    $savedWordsTitleContainer.innerHTML = `
                        <h3 class="saved-words-title" id="saved-words-title">Palabras guardadas</h3>
                    `;
                }
        }

        containsClass(arr, className) {
            for (let i = 0; i < arr.length; i++) {
                if (arr[i] == className) {
                    return true;
                }
            }
            return false;
        }

        toggleSavedWords = () => {
            const { $savedWordsContainer } = this.state;
            if (this.containsClass($savedWordsContainer.classList, "saved-words-active")) {
                $savedWordsContainer.classList.remove("saved-words-active");
            if (this.state.currentOpenedSavedWord) {
                document.querySelector('.saved-definitions-container').style.overflowY = "hidden";
                document.querySelector('.saved-definitions-container').style.display = "none";
            }
            setTimeout(() => {
                document.querySelector('body').style.overflowY = "auto";
            }, 250);
        } else {
            $savedWordsContainer.classList.add("saved-words-active");
            if (this.state.currentOpenedSavedWord) {
                document.querySelector('.saved-definitions-container').style.display = "block";
                setTimeout(() => {
                    document.querySelector('.saved-definitions-container').style.overflowY = "auto";
                }, 300);
            }

            document.querySelector('body').style.overflowY = "hidden";
            if (!this.state.isInDefinition && this.state.hasSavedWord) {
                this.displaySavedWords();
            }
            if (this.state.savedWordsOpened || this.state.isInDefinition) {
                return;
            }
            this.displaySavedWords();
        }
    }

    addSearchAgainListener() {
        document.querySelector('.search-again').addEventListener('click', function() {
            this.state.$searchBar.value = "";
            this.state.$searchBar.focus();
        }.bind(this))
    }

    addSaveButtonListener() {
        function formatExample(example) {
            return example.slice(1, example.length - 1);
        }

        const buttons = document.querySelectorAll('.definition-button');
        const wordTitle = document.querySelector('.word').innerText;
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', e => {
                try {
                    addWord(db, { 
                        word: wordTitle, definition: e.target.parentElement.parentElement.childNodes[1].innerText,
                        example: formatExample(e.target.parentElement.parentElement.childNodes[3].innerText) })
                } catch(e) {
                    if (e.message.includes("UNIQUE")) {
                        this.displayNotification({ error: true, message: "Ya agregaste esta definicion." });
                        return;
                    }
                }
                this.state.hasSavedWord = true;
                if (this.state.currentOpenedSavedWord === this.state.currentWord && this.state.isInDefinition) {
                    this.displaySavedWord(this.state.currentWord);
                }
                
                this.displayNotification({ message: "Definicion agregada con ??xito" });
            })
        }
    }

    displayLoading() {
        this.state.$resultContainer.innerHTML = `
            <div class="lds-dual-ring"></div>
        `
    }
}

new App();
