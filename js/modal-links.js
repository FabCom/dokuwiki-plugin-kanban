/**
 * Kanban Plugin JavaScript - Modal Links Module (Clean Version)
 * Internal links management using DokuWiki LinkWizard
 * @version 2.2.0 - Clean rewrite
 */

(function() {
    'use strict';

    /**
     * Show page browser modal for selecting a page
     */
    function showPageBrowserModal(onPageSelected) {
        const modal = window.KanbanModalCore.createModal('kanban-page-browser-modal', 'Sélectionner une page');
        
        const form = createPageBrowserForm();
        const modalBody = modal.querySelector('.kanban-modal-body');
        modalBody.innerHTML = '';
        modalBody.appendChild(form);
        
        // Add footer
        const footer = document.createElement('div');
        footer.className = 'kanban-modal-footer';
        footer.innerHTML = 
            '<button type="button" class="kanban-btn kanban-btn-secondary" id="cancelPageBrowser">Annuler</button>';
        
        modalBody.appendChild(footer);
        
        // Bind events
        bindPageBrowserEvents(modal, onPageSelected);
        
        // Show modal
        modal.style.display = 'block';
        
        // Load initial page browser (load root with empty query)
        loadPageBrowser(modal, onPageSelected);
        
        return modal;
    }

    /**
     * Create page browser form
     */
    function createPageBrowserForm() {
        const form = document.createElement('div');
        form.className = 'kanban-page-browser-form';
        form.innerHTML = 
            '<div class="page-browser" id="pageBrowser">' +
                '<div class="browser-search">' +
                    '<input type="text" id="pageSearch" placeholder="Rechercher une page..." class="kanban-input">' +
                    '<button type="button" id="backBtn" class="kanban-btn kanban-btn-secondary" style="display: none; margin-left: 10px;" title="Retour au dossier parent">⬅ Retour</button>' +
                '</div>' +
                '<div class="browser-content">' +
                    '<div class="namespaces-list" id="namespacesList">' +
                        '<div class="namespace-header">📁 Dossiers</div>' +
                        '<div id="namespacesContent"></div>' +
                    '</div>' +
                    '<div class="pages-list" id="pagesList">' +
                        '<div class="pages-header">📄 Pages</div>' +
                        '<div id="pagesContent"></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        
        return form;
    }

    /**
     * Bind page browser events
     */
    function bindPageBrowserEvents(modal, onPageSelected) {
        // Initialize navigation stack
        if (!modal.navigationStack) {
            modal.navigationStack = [];
        }
        
        // Cancel
        modal.querySelector('#cancelPageBrowser').addEventListener('click', () => {
            window.KanbanModalCore.closeModal(modal);
        });
        
        // Back button
        modal.querySelector('#backBtn').addEventListener('click', () => {
            if (modal.navigationStack.length > 0) {
                const previousQuery = modal.navigationStack.pop();
                const searchInput = modal.querySelector('#pageSearch');
                searchInput.value = previousQuery;
                
                if (previousQuery === '') {
                    loadPageBrowser(modal, onPageSelected);
                } else {
                    searchPages(modal, previousQuery, onPageSelected);
                }
                
                // Hide back button if we're at root
                if (modal.navigationStack.length === 0) {
                    modal.querySelector('#backBtn').style.display = 'none';
                }
            }
        });
        
        // Page search with debounce
        let searchTimer = null;
        modal.querySelector('#pageSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchPages(modal, e.target.value, onPageSelected);
            }, 300);
        });
    }

    /**
     * Load page browser with optional callback for page selection
     */
    function loadPageBrowser(modal, onPageSelected = null) {
        loadPageBrowserWithQuery(modal, '', onPageSelected);
    }

    /**
     * Load page browser with specific query and callback
     */
    function loadPageBrowserWithQuery(modal, query, onPageSelected = null) {
        const namespacesContent = modal.querySelector('#namespacesContent');
        const pagesContent = modal.querySelector('#pagesContent');
        
        // Show loading states
        namespacesContent.innerHTML = '<div class="loading">Chargement...</div>';
        pagesContent.innerHTML = '<div class="loading">Chargement...</div>';
        
        // Use DokuWiki's LinkWizard AJAX endpoint
        const xhr = new XMLHttpRequest();
        xhr.open('POST', DOKU_BASE + 'lib/exe/ajax.php');
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    processLinkWizardResponse(xhr.responseText, namespacesContent, pagesContent, modal, onPageSelected);
                } catch (error) {
                    console.error('Error parsing LinkWizard response:', error);
                    namespacesContent.innerHTML = '<div class="error">Erreur de parsing</div>';
                    pagesContent.innerHTML = '<div class="error">Erreur de parsing</div>';
                }
            } else {
                namespacesContent.innerHTML = '<div class="error">Erreur (' + xhr.status + ')</div>';
                pagesContent.innerHTML = '<div class="error">Erreur (' + xhr.status + ')</div>';
            }
        };
        
        xhr.onerror = function() {
            namespacesContent.innerHTML = '<div class="error">Erreur de connexion</div>';
            pagesContent.innerHTML = '<div class="error">Erreur de connexion</div>';
        };
        
        // Send request to DokuWiki LinkWizard
        const params = 'call=linkwiz&q=' + encodeURIComponent(query);
        xhr.send(params);
    }

    /**
     * Search pages (same as loadPageBrowserWithQuery but clear if empty)
     */
    function searchPages(modal, query, onPageSelected) {
        if (!query.trim()) {
            loadPageBrowser(modal, onPageSelected);
            return;
        }
        loadPageBrowserWithQuery(modal, query, onPageSelected);
    }

    /**
     * Process LinkWizard response exactly like QuillJS does
     */
    function processLinkWizardResponse(responseText, namespacesDiv, pagesDiv, modal, onPageSelected) {
        // Parse HTML response
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = responseText;
        
        const namespaces = [];
        const pages = [];
        
        // Get all result divs like QuillJS does
        const resultDivs = tempDiv.querySelectorAll('div');
        resultDivs.forEach(function(div) {
            const link = div.querySelector('a');
            if (!link) return;
            
            if (div.classList.contains('type_d')) {
                // It's a namespace - store the outerHTML like QuillJS
                namespaces.push(div.outerHTML);
            } else if (div.classList.contains('type_f')) {
                // It's a page - store the outerHTML like QuillJS
                pages.push(div.outerHTML);
            }
        });
        
        // Display namespaces
        namespacesDiv.innerHTML = namespaces.length > 0 ? namespaces.join('') : '<div class="no-results">Aucun dossier</div>';
        
        // Display pages
        pagesDiv.innerHTML = pages.length > 0 ? pages.join('') : '<div class="no-results">Aucune page</div>';
        
        // Process results (bind events)
        processNamespaceResults(namespacesDiv, modal, onPageSelected);
        processPageResults(pagesDiv, modal, onPageSelected);
    }

    /**
     * Process namespace results for navigation (like QuillJS)
     */
    function processNamespaceResults(namespacesDiv, modal, onPageSelected) {
        const namespaceLinks = namespacesDiv.querySelectorAll('a');
        
        namespaceLinks.forEach(function(link) {
            const href = link.getAttribute('href');
            let namespaceName = '';
            
            // Extract namespace name from href
            if (href) {
                const matches = href.match(/[?&]id=([^&]+)/);
                if (matches) {
                    namespaceName = decodeURIComponent(matches[1]);
                }
            }
            
            if (!namespaceName) {
                namespaceName = link.textContent.trim();
            }
            
            // Skip parent navigation links
            if (namespaceName === ':' || link.textContent.includes('Aller à la catégorie parente')) {
                return;
            }
            
            // Extract only the last part of namespace (like QuillJS does)
            const cleanNamespace = namespaceName.replace(/:+$/, ''); // Remove trailing ':'
            const parts = cleanNamespace.split(':');
            const lastPart = parts.length > 0 ? parts[parts.length - 1] : namespaceName;
            link.textContent = lastPart;
            
            // Style like QuillJS
            link.style.display = 'block';
            link.style.padding = '8px 12px';
            link.style.textDecoration = 'none';
            link.style.color = '#0066cc';
            link.style.borderBottom = '1px solid #eee';
            link.style.fontSize = '13px';
            link.style.wordWrap = 'break-word';
            link.style.wordBreak = 'break-all';
            link.style.lineHeight = '1.3';
            link.title = 'Cliquer pour explorer ce dossier: ' + namespaceName;
            
            link.addEventListener('mouseenter', function() {
                this.style.background = '#e6f3ff';
            });
            
            link.addEventListener('mouseleave', function() {
                this.style.background = 'transparent';
            });
            
            link.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Navigation vers namespace:', namespaceName);
                
                // Add to navigation stack (save current search query)
                const searchInput = modal.querySelector('#pageSearch');
                const currentQuery = searchInput ? searchInput.value : '';
                
                if (!modal.navigationStack) {
                    modal.navigationStack = [];
                }
                modal.navigationStack.push(currentQuery);
                
                // Show back button
                const backBtn = modal.querySelector('#backBtn');
                if (backBtn) {
                    backBtn.style.display = 'inline-block';
                }
                
                // Navigate like QuillJS: update search and reload
                if (searchInput) {
                    searchInput.value = namespaceName;
                }
                
                // Load content of this namespace
                loadPageBrowserWithQuery(modal, namespaceName, onPageSelected);
            });
        });
    }

    /**
     * Process page results for selection (like QuillJS)
     */
    function processPageResults(pagesDiv, modal, onPageSelected) {
        const pageLinks = pagesDiv.querySelectorAll('a');
        
        pageLinks.forEach(function(link) {
            const href = link.getAttribute('href');
            let pageName = '';
            
            // Extract page name from href
            if (href) {
                const matches = href.match(/[?&]id=([^&]+)/);
                if (matches) {
                    pageName = decodeURIComponent(matches[1]);
                }
            }
            
            if (!pageName) {
                pageName = link.textContent.trim();
            }
            
            // Extract only the last part of page name (like QuillJS)
            const lastPagePart = pageName.split(':').pop() || pageName;
            
            // Modify displayed text to show only page name
            link.textContent = lastPagePart;
            
            // Hide the title span if it exists
            const titleSpan = link.parentElement.querySelector('span');
            if (titleSpan) {
                titleSpan.style.display = 'none';
            }
            
            // Style like QuillJS
            link.style.display = 'block';
            link.style.padding = '8px 12px';
            link.style.textDecoration = 'none';
            link.style.color = '#333';
            link.style.borderBottom = '1px solid #eee';
            link.style.fontSize = '13px';
            link.style.wordWrap = 'break-word';
            link.style.wordBreak = 'break-all';
            link.style.lineHeight = '1.3';
            link.title = 'Cliquer pour sélectionner cette page: ' + pageName;
            
            link.addEventListener('mouseenter', function() {
                this.style.background = '#f0f0f0';
            });
            
            link.addEventListener('mouseleave', function() {
                this.style.background = 'transparent';
            });
            
            link.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Page sélectionnée:', pageName);
                
                if (onPageSelected) {
                    onPageSelected({ 
                        id: pageName, 
                        title: lastPagePart 
                    });
                    window.KanbanModalCore.closeModal(modal);
                } else {
                    // Fallback for old modal compatibility
                    const linkTarget = modal.querySelector('#linkTarget');
                    if (linkTarget) {
                        linkTarget.value = pageName;
                    }
                    
                    const pageBrowser = modal.querySelector('#pageBrowser');
                    if (pageBrowser) {
                        pageBrowser.style.display = 'none';
                    }
                }
            });
        });
    }

    // Public API
    window.KanbanModalLinks = {
        showPageBrowserModal: showPageBrowserModal,
        loadPageBrowser: loadPageBrowser
    };

})();
