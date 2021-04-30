class App {
    constructor() {
        this.state = {
            $changeThemeButton: document.getElementById('changetheme-button'),
            $currentTheme: document.getElementById('theme-link'),
            $searchBar: document.getElementById('searchbar'),
            $resultContainer: document.getElementById('search-result'),
            $aboutModal: document.getElementById('about-modal'),
            searchQuery: ''
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

        // Close Button
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
            if (this.state.$currentTheme.getAttribute('href') == './styles/light-theme.css') {
                window.localStorage.setItem('theme', 'dark-theme');
                this.state.$currentTheme.setAttribute('href', './styles/dark-theme.css');
                document.querySelector('.dark-enabled').classList.remove('dark-disabled');
            } else {
                window.localStorage.setItem('theme', 'light-theme');
                this.state.$currentTheme.setAttribute('href', './styles/light-theme.css');
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
                new Notification('Definicion copiada!', { body: `La definicion de ${this.id} se copió al portapapeles`})
            })
        }
    }

    displayResult(result) {
        const formatedResults = result.meanings[0].definitions.map(definition => `
            <div class="definition-container">
                <p class="definition" id="${result.word.charAt(0).toUpperCase() + result.word.slice(1)}">
                    ${definition.definition}
                </p>
                ${definition.example ? `
                    <span class="definition-example">
                        "${definition.example}"
                    </span>
                ` : '<div style="display: none"></div>' }
            </div>
        `);

        this.state.$resultContainer.innerHTML = `
            <div class="result hide">
                <h3 class="word" style="${result.word.length > 14 ? 'font-size: 3em' : 'font-size: 3em'}">${result.word}</h3>
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

    displayLoading() {
        this.state.$resultContainer.innerHTML = `
            <div class="lds-dual-ring"></div>
        `
    }
}

new App();