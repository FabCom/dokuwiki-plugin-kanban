/**
 * Kanban Plugin - Media Management Module
 * Inspired by modal-links.js for seamless DokuWiki integration using native endpoints
 */

(function() {
    'use strict';

    /**
     * Show media browser modal for selecting media files
     */
    function showMediaBrowser(onMediaSelected) {
        const modal = window.KanbanModalCore.createModal('kanban-media-browser-modal', 'Sélectionner un média');
        
        const form = createMediaBrowserForm();
        const modalBody = modal.querySelector('.kanban-modal-body');
        modalBody.innerHTML = '';
        modalBody.appendChild(form);
        
        // Add footer
        const footer = document.createElement('div');
        footer.className = 'kanban-modal-footer';
        footer.innerHTML = 
            '<button type="button" class="kanban-btn kanban-btn-secondary" id="cancelMediaBrowser">Annuler</button>';
        
        modalBody.appendChild(footer);
        
        // Bind events
        bindMediaBrowserEvents(modal, onMediaSelected);
        
        // Show modal
        modal.style.display = 'block';
        
        // Load initial media browser (load root namespace)
        loadMediaBrowser(modal, onMediaSelected);
        
        return modal;
    }

    /**
     * Create media browser form
     */
    function createMediaBrowserForm() {
        const form = document.createElement('div');
        form.className = 'kanban-media-browser-form';
        form.innerHTML = 
            '<div class="media-browser" id="mediaBrowser">' +
                '<div class="browser-actions">' +
                    '<div class="browser-search">' +
                        '<input type="text" id="mediaSearch" placeholder="Rechercher un média..." class="kanban-input">' +
                        '<button type="button" id="searchMediaBtn" class="kanban-btn-small">🔍</button>' +
                    '</div>' +
                    '<div class="browser-upload">' +
                        '<input type="file" id="mediaUpload" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt" style="display: none;">' +
                        '<button type="button" id="uploadMediaBtn" class="kanban-btn-small">📤 Upload</button>' +
                    '</div>' +
                '</div>' +
                '<div class="browser-breadcrumb" id="mediaBreadcrumb"></div>' +
                '<div class="browser-content">' +
                    '<div class="browser-folders" id="mediaFolders">' +
                        '<h4>📁 Dossiers</h4>' +
                        '<div id="foldersContent" class="folders-content"></div>' +
                    '</div>' +
                    '<div class="browser-files" id="mediaFiles">' +
                        '<h4>📎 Fichiers</h4>' +
                        '<div id="filesContent" class="files-content"></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        
        return form;
    }

    /**
     * Bind media browser events
     */
    function bindMediaBrowserEvents(modal, onMediaSelected) {
        // Cancel button
        modal.querySelector('#cancelMediaBrowser').addEventListener('click', () => {
            window.KanbanModalCore.closeModal(modal);
        });

        // Search functionality
        const searchInput = modal.querySelector('#mediaSearch');
        const searchBtn = modal.querySelector('#searchMediaBtn');
        
        const doSearch = () => {
            const query = searchInput.value.trim();
            if (query) {
                searchMedia(modal, query, onMediaSelected);
            } else {
                loadMediaBrowser(modal, onMediaSelected);
            }
        };
        
        searchBtn.addEventListener('click', doSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                doSearch();
            }
        });

        // Upload functionality
        const uploadInput = modal.querySelector('#mediaUpload');
        const uploadBtn = modal.querySelector('#uploadMediaBtn');
        
        uploadBtn.addEventListener('click', () => {
            uploadInput.click();
        });
        
        uploadInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                uploadMedia(modal, files, onMediaSelected);
            }
        });

        // Drag & Drop functionality
        setupDragAndDrop(modal, onMediaSelected);
    }

    /**
     * Setup drag and drop functionality
     */
    function setupDragAndDrop(modal, onMediaSelected) {
        const dropZone = modal.querySelector('#mediaBrowser');
        const filesContent = modal.querySelector('#filesContent');
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });
        
        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            }, false);
        });
        
        // Handle dropped files
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                uploadMedia(modal, files, onMediaSelected);
            }
        }, false);
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    /**
     * Load media browser (equivalent to loadPageBrowser)
     */
    function loadMediaBrowser(modal, onMediaSelected = null) {
        loadMediaBrowserWithNamespace(modal, '', onMediaSelected);
    }

    /**
     * Load media browser with specific namespace
     */
    function loadMediaBrowserWithNamespace(modal, namespace, onMediaSelected = null) {
        const foldersContent = modal.querySelector('#foldersContent');
        const filesContent = modal.querySelector('#filesContent');
        
        // Show loading states
        foldersContent.innerHTML = '<div class="loading">Chargement des dossiers...</div>';
        filesContent.innerHTML = '<div class="loading">Chargement des fichiers...</div>';
        
        // Update breadcrumb
        updateMediaBreadcrumb(modal, namespace, onMediaSelected);
        
        // Use Kanban plugin's own media-list endpoint that respects ACL
        const url = DOKU_BASE + 'lib/plugins/kanban/ajax/media-list.php';
        const params = new URLSearchParams({
            'action': 'list',
            'ns': namespace || ''
        });
        
        fetch(url + '?' + params.toString(), {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            processMediaResponse(data, foldersContent, filesContent, modal, onMediaSelected);
        })
        .catch(error => {
            console.error('Error loading media:', error);
            foldersContent.innerHTML = '<div class="error">Erreur de chargement des dossiers</div>';
            filesContent.innerHTML = '<div class="error">Erreur de chargement des fichiers</div>';
        });
    }

    /**
     * Search media files
     */
    function searchMedia(modal, query, onMediaSelected) {
        const foldersContent = modal.querySelector('#foldersContent');
        const filesContent = modal.querySelector('#filesContent');
        
        foldersContent.innerHTML = '<div class="info">🔍 Recherche en cours...</div>';
        filesContent.innerHTML = '<div class="info">🔍 Recherche en cours...</div>';
        
        // Use Kanban plugin's media-search endpoint
        const url = DOKU_BASE + 'lib/plugins/kanban/ajax/media-search.php';
        const params = new URLSearchParams({
            'q': query,
            'limit': '50'
        });
        
        fetch(url + '?' + params.toString(), {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Clear folders during search
                foldersContent.innerHTML = '<div class="info">📁 Recherche dans tous les dossiers</div>';
                
                // Show search results in files section
                renderSearchResults(data.results, filesContent, modal, onMediaSelected, query);
            } else {
                throw new Error(data.message || 'Erreur de recherche');
            }
        })
        .catch(error => {
            console.error('Error searching media:', error);
            foldersContent.innerHTML = '<div class="error">Erreur de recherche</div>';
            filesContent.innerHTML = '<div class="error">Erreur de recherche: ' + error.message + '</div>';
        });
    }

    /**
     * Process media response from our Kanban endpoint
     */
    function processMediaResponse(data, foldersDiv, filesDiv, modal, onMediaSelected) {
        if (foldersDiv && data.folders) {
            renderMediaFolders(data.folders, foldersDiv, modal, onMediaSelected);
        }
        
        if (filesDiv && data.files) {
            renderMediaFiles(data.files, filesDiv, modal, onMediaSelected);
        }
        
        // Update breadcrumb if data includes it
        if (data.breadcrumb) {
            updateMediaBreadcrumbFromData(modal, data.breadcrumb, onMediaSelected);
        }
    }

    /**
     * Update breadcrumb for namespace navigation
     */
    function updateMediaBreadcrumb(modal, namespace, onMediaSelected) {
        const breadcrumbDiv = modal.querySelector('#mediaBreadcrumb');
        if (!breadcrumbDiv) return;
        
        // Simple breadcrumb for namespace
        let breadcrumbHTML = '<span class="breadcrumb-item" data-ns="">🏠 Racine</span>';
        
        if (namespace) {
            const parts = namespace.split(':');
            let currentPath = '';
            
            parts.forEach(part => {
                if (part) {
                    currentPath += (currentPath ? ':' : '') + part;
                    breadcrumbHTML += ` › <span class="breadcrumb-item" data-ns="${currentPath}">${part}</span>`;
                }
            });
        }
        
        breadcrumbDiv.innerHTML = breadcrumbHTML;
        
        // Bind breadcrumb navigation
        breadcrumbDiv.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.addEventListener('click', () => {
                const ns = item.getAttribute('data-ns');
                loadMediaBrowserWithNamespace(modal, ns, onMediaSelected);
            });
        });
    }

    /**
     * Update breadcrumb from server data
     */
    function updateMediaBreadcrumbFromData(modal, breadcrumbData, onMediaSelected) {
        const breadcrumbDiv = modal.querySelector('#mediaBreadcrumb');
        
        let html = '';
        breadcrumbData.forEach((item, index) => {
            if (index > 0) html += ' / ';
            html += `<span class="breadcrumb-item ${index === breadcrumbData.length - 1 ? 'current' : ''}" 
                           data-namespace="${item.namespace}">${escapeHtml(item.name)}</span>`;
        });
        
        breadcrumbDiv.innerHTML = html;
        
        // Add click handlers for non-current items
        breadcrumbDiv.querySelectorAll('.breadcrumb-item:not(.current)').forEach(item => {
            item.onclick = () => {
                const namespace = item.dataset.namespace;
                loadMediaBrowserWithNamespace(modal, namespace, onMediaSelected);
            };
        });
    }

    /**
     * Render media folders
     */
    function renderMediaFolders(folders, container, modal, onMediaSelected) {
        if (folders.length === 0) {
            container.innerHTML = '<div class="no-results">Aucun sous-dossier</div>';
            return;
        }

        let html = '';
        folders.forEach(folder => {
            html += `
                <div class="folder-item" data-namespace="${folder.namespace}">
                    <span class="folder-icon">📁</span>
                    <span class="folder-name">${escapeHtml(folder.name)}</span>
                </div>
            `;
        });

        container.innerHTML = html;

        // Add click handlers for folders
        container.querySelectorAll('.folder-item').forEach(item => {
            item.onclick = () => {
                const namespace = item.dataset.namespace;
                loadMediaBrowserWithNamespace(modal, namespace, onMediaSelected);
            };
        });
    }

    /**
     * Render media files with previews
     */
    function renderMediaFiles(files, container, modal, onMediaSelected) {
        if (!files || files.length === 0) {
            container.innerHTML = '<div class="no-files">Aucun fichier dans ce dossier</div>';
            return;
        }
        
        const grid = document.createElement('div');
        grid.className = 'media-grid';
        
        files.forEach(file => {
            const item = createMediaItem(file, onMediaSelected);
            grid.appendChild(item);
        });
        
        container.innerHTML = '';
        container.appendChild(grid);
    }

    /**
     * Generate image thumbnail URL with token
     */
    function generateImageThumbnail(mediaId, previewElement) {
        const baseUrl = window.DOKU_BASE || '';
        // Ensure media parameter comes first
        const thumbUrl = baseUrl + 'lib/exe/fetch.php?media=' + encodeURIComponent(mediaId) + '&w=150&h=150';
        
        const img = document.createElement('img');
        img.src = thumbUrl;
        img.alt = 'Preview';
        img.onerror = function() {
            previewElement.innerHTML = '<div class="media-icon">🖼️</div>';
        };
        previewElement.appendChild(img);
    }

    /**
     * Escape HTML for safe display
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Upload media files
     */
    function uploadMedia(modal, files, onMediaSelected) {
        const filesContent = modal.querySelector('#filesContent');
        
        // Create upload progress container
        const progressContainer = document.createElement('div');
        progressContainer.className = 'upload-progress-container';
        progressContainer.innerHTML = `
            <div class="upload-header">
                <h4>📤 Upload en cours (${files.length} fichier${files.length > 1 ? 's' : ''})</h4>
                <div class="upload-overall-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="overallProgress"></div>
                    </div>
                    <span class="progress-text" id="overallProgressText">0%</span>
                </div>
            </div>
            <div class="upload-files-list" id="uploadFilesList"></div>
        `;
        filesContent.appendChild(progressContainer);
        
        // Get current namespace from breadcrumb or use root
        const currentNamespace = getCurrentNamespace(modal);
        
        let completedUploads = 0;
        const updateOverallProgress = () => {
            const progress = Math.round((completedUploads / files.length) * 100);
            const progressBar = modal.querySelector('#overallProgress');
            const progressText = modal.querySelector('#overallProgressText');
            
            progressBar.style.width = progress + '%';
            progressText.textContent = progress + '%';
            
            if (completedUploads === files.length) {
                setTimeout(() => {
                    loadMediaBrowserWithNamespace(modal, currentNamespace, onMediaSelected);
                }, 1500);
            }
        };
        
        // Upload each file
        Array.from(files).forEach((file, index) => {
            uploadSingleFile(file, currentNamespace, modal.querySelector('#uploadFilesList'), () => {
                completedUploads++;
                updateOverallProgress();
            });
        });
    }
    
    /**
     * Upload a single file with progress
     */
    function uploadSingleFile(file, namespace, container, callback) {
        // Create file progress item
        const fileItem = document.createElement('div');
        fileItem.className = 'upload-file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${formatFileSize(file.size)})</span>
            </div>
            <div class="file-progress">
                <div class="progress-bar-container">
                    <div class="progress-bar" id="progress-${Date.now()}-${Math.random()}"></div>
                </div>
                <span class="progress-text">0%</span>
            </div>
            <div class="file-status">En cours...</div>
        `;
        container.appendChild(fileItem);
        
        const progressBar = fileItem.querySelector('.progress-bar');
        const progressText = fileItem.querySelector('.progress-text');
        const statusDiv = fileItem.querySelector('.file-status');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('namespace', namespace || '');
        formData.append('sectok', getSecurityToken());
        
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percentComplete + '%';
                progressText.textContent = percentComplete + '%';
            }
        });
        
        // Handle completion
        xhr.addEventListener('load', () => {
            try {
                const data = JSON.parse(xhr.responseText);
                statusDiv.textContent = data.success ? '✅ Terminé' : '❌ ' + data.message;
                statusDiv.className = 'file-status ' + (data.success ? 'success' : 'error');
                
                // Show global notification for better visibility
                if (data.success) {
                    const fileInfo = data.data || {};
                    const fileSize = fileInfo.size ? formatFileSize(fileInfo.size) : '';
                    const fileType = fileInfo.ext ? fileInfo.ext.toUpperCase() : '';
                    
                    const successMessage = `✅ Fichier uploadé: ${file.name}${fileType ? ` (${fileType})` : ''}`;
                    
                    if (window.KanbanUtils && window.KanbanUtils.showNotification) {
                        window.KanbanUtils.showNotification(successMessage, 'success', {
                            duration: 4000
                        });
                    }
                } else {
                    // Simple error notification like QuillJS
                    const errorMessage = getUploadErrorDetails(data.message, file);
                    
                    if (window.KanbanUtils && window.KanbanUtils.showNotification) {
                        window.KanbanUtils.showNotification(errorMessage, 'error', {
                            duration: 7000
                        });
                    }
                }
            } catch (e) {
                statusDiv.textContent = '❌ Erreur d\'upload';
                statusDiv.className = 'file-status error';
                
                // Simple error notification
                const errorMessage = `❌ Erreur de traitement: ${file.name}`;
                
                if (window.KanbanUtils && window.KanbanUtils.showNotification) {
                    window.KanbanUtils.showNotification(errorMessage, 'error', {
                        duration: 6000
                    });
                }
            }
            
            if (callback) callback();
        });
        
        // Handle errors
        xhr.addEventListener('error', () => {
            statusDiv.textContent = '❌ Erreur réseau';
            statusDiv.className = 'file-status error';
            progressBar.style.width = '100%';
            progressBar.style.backgroundColor = '#dc3545';
            
            // Global network error notification
            const errorMessage = `🌐 Erreur réseau: ${file.name}`;
            
            if (window.KanbanUtils && window.KanbanUtils.showNotification) {
                window.KanbanUtils.showNotification(errorMessage, 'error', {
                    duration: 6000
                });
            }
            
            if (callback) callback();
        });
        
        const url = DOKU_BASE + 'lib/plugins/kanban/ajax/media-upload.php';
        xhr.open('POST', url);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.send(formData);
    }
    
    /**
     * Get current namespace from modal
     */
    function getCurrentNamespace(modal) {
        const breadcrumbItems = modal.querySelectorAll('.breadcrumb-item');
        const lastItem = breadcrumbItems[breadcrumbItems.length - 1];
        return lastItem ? lastItem.getAttribute('data-ns') || '' : '';
    }
    
    /**
     * Get security token for uploads
     */
    function getSecurityToken() {
        return window.sectok || '';
    }
    
    /**
     * Render search results with previews
     */
    function renderSearchResults(results, container, modal, onMediaSelected, query) {
        if (!results || results.length === 0) {
            container.innerHTML = '<div class="info">Aucun résultat trouvé pour "' + query + '"</div>';
            return;
        }
        
        container.innerHTML = `<div class="search-results-info">🔍 ${results.length} résultat(s) pour "${query}"</div>`;
        
        const grid = document.createElement('div');
        grid.className = 'media-grid';
        
        results.forEach(media => {
            const item = createMediaItem(media, onMediaSelected);
            grid.appendChild(item);
        });
        
        container.appendChild(grid);
    }
    
    /**
     * Create a media item with preview
     */
    function createMediaItem(media, onMediaSelected) {
        const item = document.createElement('div');
        item.className = 'media-item';
        item.setAttribute('data-media-id', media.id);
        
        // Create preview
        const preview = document.createElement('div');
        preview.className = 'media-preview';
        
        // Get extension - handle both 'ext' and 'extension' properties
        const ext = media.ext || media.extension || '';
        const mediaType = media.type || media.mediaType || 'document';
        
        // Check if it's an image by extension if type is not explicitly 'image'
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        const isImage = mediaType === 'image' || imageExtensions.includes(ext.toLowerCase());
        
        if (isImage && media.thumb) {
            const img = document.createElement('img');
            img.src = media.thumb;
            img.alt = media.name;
            img.onerror = function() {
                this.style.display = 'none';
                preview.innerHTML = '<div class="media-icon">🖼️<br>' + media.name + '</div>';
            };
            preview.appendChild(img);
        } else if (isImage) {
            // Try to generate thumbnail URL with token
            generateImageThumbnail(media.id, preview);
        } else {
            // Non-image files get an icon based on type
            const icon = getMediaIcon(ext, mediaType);
            preview.innerHTML = `<div class="media-icon">${icon}</div>`;
        }
        
        // Create info section
        const info = document.createElement('div');
        info.className = 'media-info';
        const fileSize = media.size || media.size_human || 0;
        info.innerHTML = `
            <div class="media-name">${media.name}</div>
            <div class="media-meta">${ext ? ext.toUpperCase() : 'FILE'} • ${formatFileSize(fileSize)}</div>
            ${media.namespace ? `<div class="media-namespace">📁 ${media.namespace}</div>` : ''}
        `;
        
        item.appendChild(preview);
        item.appendChild(info);
        
        // Click handler
        item.addEventListener('click', () => {
            if (onMediaSelected) {
                onMediaSelected({
                    id: media.id,
                    name: media.filename || media.name,
                    type: mediaType,
                    url: media.url,
                    thumb: media.thumb
                });
                
                // Close the media browser modal after selection
                const modal = document.getElementById('kanban-media-browser-modal');
                if (modal && window.KanbanModalCore) {
                    window.KanbanModalCore.closeModal(modal);
                }
            }
        });
        
        return item;
    }
    
    /**
     * Get icon for media type
     */
    function getMediaIcon(ext, mediaType) {
        // Ensure ext is a string
        ext = ext || '';
        
        const icons = {
            // Images
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'svg': '🖼️', 'bmp': '🖼️',
            // Videos
            'mp4': '🎬', 'avi': '🎬', 'mov': '🎬', 'webm': '🎬', 'ogv': '🎬', 'wmv': '🎬', 'flv': '🎬',
            // Audio
            'mp3': '🎵', 'wav': '🎵', 'ogg': '🎵', 'aac': '🎵', 'm4a': '🎵',
            // Documents
            'pdf': '📄', 'doc': '📝', 'docx': '📝', 'txt': '📝', 'rtf': '📝',
            'xls': '📊', 'xlsx': '📊', 'ods': '📊',
            'ppt': '📈', 'pptx': '📈', 'odp': '📈',
            'odt': '📝',
            // Archives
            'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
            // Default
            'default': '📎'
        };
        
        return icons[(ext || '').toLowerCase()] || icons.default;
    }
    
    /**
     * Format file size
     */
    function formatFileSize(bytes) {
        // If bytes is already a formatted string, return it
        if (typeof bytes === 'string') {
            return bytes;
        }
        
        const numBytes = parseInt(bytes) || 0;
        if (numBytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(numBytes) / Math.log(k));
        return parseFloat((numBytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Get detailed error information for upload failures
     */
    function getUploadErrorDetails(errorMessage, file) {
        const fileName = file.name || 'inconnu';
        const fileSize = file.size ? formatFileSize(file.size) : 'inconnue';
        const fileExt = fileName.split('.').pop()?.toUpperCase() || '';
        
        // Simple format like QuillJS - just the essential info
        if (errorMessage) {
            const lowerError = errorMessage.toLowerCase();
            
            if (lowerError.includes('permissions') || lowerError.includes('auth')) {
                return `🔒 Permissions insuffisantes pour: ${fileName}`;
            } else if (lowerError.includes('size') || lowerError.includes('taille') || lowerError.includes('too large')) {
                return `📏 Fichier trop volumineux: ${fileName} (${fileSize})`;
            } else if (lowerError.includes('type') || lowerError.includes('format') || lowerError.includes('extension')) {
                return `📄 Type non autorisé: ${fileName} (.${fileExt.toLowerCase()})`;
            } else if (lowerError.includes('exists') || lowerError.includes('existe')) {
                return `📎 Fichier existe déjà: ${fileName}`;
            } else if (lowerError.includes('espace') || lowerError.includes('space') || lowerError.includes('disk')) {
                return `💾 Espace disque insuffisant pour: ${fileName}`;
            } else {
                return `❌ Erreur: ${errorMessage}`;
            }
        } else {
            return `❌ Erreur d'upload: ${fileName}`;
        }
    }

    // Export to global scope
    window.KanbanMediaManager = {
        showMediaBrowser
    };

})();
