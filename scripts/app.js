const { ipcRenderer } = require('electron');
const PouchDB = require('pouchdb');
const db = new PouchDB('wordsdb');

class App {
    constructor() {
        this.state = {
            $minimizeButton: document.getElementById('minimize-button'),
            $closeButton: document.getElementById('close-button'),
            $changeThemeButton: document.getElementById('changetheme-button'),
            $searchBar: document.getElementById('searchbar'),
            $resultContainer: document.getElementById('search-result'),
            $aboutModal: document.getElementById('about-modal'),

            searchQuery: '',
            currentTheme: document.getElementById('theme-link'),
            currentWord: ''
        }

        this.addListeners();
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
            .then(data => this.displayResult(data[0]))
            .catch(e => this.displayError());
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
            <div class="definition-container">
                <div class="definition-bookmark">
                    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Layer_1" x="0px" y="0px" height="48" width="24" viewBox="0 0 122.59 122.88" style="enable-background:new 0 0 122.59 122.88" xml:space="preserve"><g><path class="bookmark-icon" d="M4.95,0h112.68c2.74,0,4.95,2.22,4.95,4.95v112.97c0,2.74-2.22,4.95-4.95,4.95c-1.37,0-2.61-0.56-3.51-1.46L61.16,75.79 L8.18,121.66c-2.06,1.78-5.18,1.56-6.97-0.5c-0.81-0.93-1.2-2.09-1.2-3.23H0V4.95C0,2.22,2.22,0,4.95,0L4.95,0z M112.68,9.91H9.91 v97.2l47.97-41.54c1.82-1.62,4.61-1.68,6.51-0.04l48.3,41.61V9.91L112.68,9.91z"/></g></svg>
                </div>
                <p class="definition">
                    ${definition.definition}
                </p>
                ${definition.example ? `
                    <span class="definition-example" id="${definition.example}">
                        "${definition.example}"
                    </span>
                ` : '<div style="display: none"></div>' }
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
        this.addBookmarkIconsListeners();
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

    addSearchAgainListener() {
        document.querySelector('.search-again').addEventListener('click', function() {
            this.state.$searchBar.value = "";
            this.state.$searchBar.focus();
        }.bind(this))
    }

    addBookmarkIconsListeners() {
        // const bookmarks = document.querySelectorAll('.definition-bookmark');
        // for (let i = 0; i < bookmarks.length; i++) {
        //     bookmarks[i].addEventListener('click', function(e) {
        //         db.get(e.target.parentElement.parentElement.childNodes[3].innerText)
        //             .then(() => console.log('Ya agregaste esa definicion'))
        //             .catch(err => {
        //                 db.put({

        //                 })
        //             })
            //     db.findOne({ definition: e.target.parentElement.parentElement.childNodes[3].innerText }, (err, doc) => {
            //         if (!doc) {
            //             const wordObject = this.createDbObject(e.target, document.querySelector('.word').innerText)
            //             db.insert(wordObject, function(err, doc) {
            //                 if (err) {
            //                     console.err(err);
            //                 }
            //                 console.log(`Agregado elemento ${doc.word} con id ${doc._id}`);
            //             })
            //         } else {
            //             console.error('Ya agregaste esa definicion');
            //         }
            //     })
            // })
    }

    displayLoading() {
        this.state.$resultContainer.innerHTML = `
            <div class="lds-dual-ring"></div>
        `
    }
}

new App();