const { ipcRenderer } = require('electron');
const Database = require('better-sqlite3');
const db = new Database('./db/dictionary.db');
const { listWords, getUniqueWords, addWord, clearWords } = require('./dbF');
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

            searchQuery: '',
            currentTheme: document.getElementById('theme-link'),
            currentWord: '',
            currentNotificationTimeout: undefined
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
        })

        /// Modal 
        document.querySelector("#about").addEventListener('click', function() {
            this.state.$aboutModal.classList.remove('hide');
            this.state.$aboutModal.style.display = "block";
        }.bind(this));

        // Toggle Saved Words Button
        this.state.$savedWordsButton.addEventListener('click', this.toggleSavedWords)

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
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/es/${this.state.$searchBar.value}`)
            .then(resp => resp.json())
            .then(data => {
                this.state.currentWord = word;
                this.displayResult(data[0])
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
                new Notification('Definicion copiada!', { body: `La definicion de ${this.id} se copió al portapapeles` })
            })
        }
    }

    displayResult(result) {
        console.log(this.state)
        const formatedResults = result.meanings[0].definitions.map(definition => `
            <div class="definition-container" id="${definition.definition}">
                <p class="definition">
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
                    <li>Verifique que haya estado escribiendo en el cuadro de búsqueda</li>
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
                    <li>Verifique que tengas conexión a internet</li>
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
        if (notificationObject.error) {
            this.state.$notificationContainer.classList.add('notification-error');
            document.querySelector('#notification-content').innerHTML = `
                ${notificationObject.message}
            `
            setTimeout(() => {
                this.state.$notificationContainer.classList.remove('notification-error');
            }, notificationTime);
            return;
        }
        this.state.$notificationContainer.classList.add('notification-success');
        document.querySelector('#notification-content').innerHTML = `
            ${notificationObject.message}
        `

        setTimeout(() => {
            this.state.$notificationContainer.classList.remove('notification-success');
        }, notificationTime);
    }

    toggleSavedWords = () => {
        function containsClass(arr, className) {
            for (let i = 0; i < arr.length; i++) {
                if (arr[i] == className) {
                    return true;
                }
            }
            return false;
        }

        const { $savedWordsContainer } = this.state;
        if (containsClass($savedWordsContainer.classList, "saved-words-active")) {
            $savedWordsContainer.classList.remove("saved-words-active");
        } else {
            $savedWordsContainer.classList.add("saved-words-active");
        }
    }

    addSearchAgainListener() {
        document.querySelector('.search-again').addEventListener('click', function() {
            this.state.$searchBar.value = "";
            this.state.$searchBar.focus();
        }.bind(this))
    }

    addSaveButtonListener() {
        const buttons = document.querySelectorAll('.definition-button');
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', e => {
                try {
                    addWord(db, { word: this.state.currentWord, definition: e.target.parentElement.parentElement.childNodes[1].innerText, example: e.target.parentElement.parentElement.childNodes[3].innerText })
                } catch(e) {
                    if (e.message.includes("UNIQUE")) {
                        this.displayNotification({ error: true, message: "Ya agregaste esta definicion." });
                        return;
                    }
                }
                this.displayNotification({ message: "Definicion agregada con éxito" });
                listWords(db);
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
