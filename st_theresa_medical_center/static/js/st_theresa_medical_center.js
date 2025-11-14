/**
 * @author Jobet P. Casquejo
 * @file st_theresa_medical_center.js
 * @description This file contains the JavaScript code for the st_theresa_medical_center theme.
 * @version 1.1
 * @date 11-14-2025
 * @copyright 2025 Jobet P. Casquejo
 * @license MIT
 * @class
 */

class AjaxHandler {
    /**
     * @constructor
     * @param {Object} options - Default options for AjaxHandler
     * @param {boolean} options.debug - Enable/disable debug logs
     * @param {number} options.defaultRetries - Default number of retry attempts
     * @param {number} options.defaultDelay - Default retry delay in ms
     */
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.defaultRetries = options.defaultRetries ?? 3;
        this.defaultDelay = options.defaultDelay ?? 500;
        this.csrfToken = this.getCsrfToken();
    }

    /**
     * Get CSRF token from cookie (Django default)
     * @returns {string} csrf token
     */
    getCsrfToken() {
        const name = 'csrftoken=';
        const decodedCookie = decodeURIComponent(document.cookie);
        const cookies = decodedCookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            let c = cookies[i].trim();
            if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
        }
        return '';
    }

    /**
     * Perform GET request
     * @param {string} url - Endpoint URL
     * @param {Object} data - Query parameters
     * @param {Object} options - Options like retries, delay, success, error, finally
     * @returns {Promise<Object>} Parsed JSON response with { success, message, data }
     */
    get(url, data = {}, options = {}) {
        return this.request('GET', url, data, options);
    }

    /**
     * Perform POST request
     * @param {string} url - Endpoint URL
     * @param {Object} data - POST body
     * @param {Object} options - Options like retries, delay, success, error, finally
     * @returns {Promise<Object>} Parsed JSON response with { success, message, data }
     */
    post(url, data = {}, options = {}) {
        return this.request('POST', url, data, options);
    }

    /**
     * Core request handler with retry logic and proper JSON response validation
     * @private
     * @param {string} method - GET or POST
     * @param {string} url - Endpoint URL
     * @param {Object} data - Data to send
     * @param {Object} options - { retries, delay, success, error, finally }
     * @returns {Promise<Object>} Parsed JSON response
     */
    request(method, url, data, options = {}) {
        const retries = options.retries ?? this.defaultRetries;
        const delay = options.delay ?? this.defaultDelay;
        let attempt = 0;

        const makeRequest = () => {
            attempt++;
            if (this.debug) console.log(`[AjaxHandler] ${method} Request to ${url}, attempt ${attempt}`);

            return $.ajax({
                url: url,
                type: method,
                data: method === 'GET' ? data : JSON.stringify(data),
                contentType: 'application/json',
                headers: { 'X-CSRFToken': this.csrfToken },
                dataType: 'json',
            })
            .then((response) => {
                // Validate JSON response structure
                if (typeof response !== 'object' || response.success === undefined) {
                    const msg = 'Malformed JSON response';
                    if (this.debug) console.error(`[AjaxHandler] ${msg}`, response);
                    return Promise.reject({ xhr: null, status: 'invalid_json', error: msg });
                }
                if (options.success) options.success(response);
                return response;
            })
            .catch((xhr, status, error) => {
                if (this.debug) console.error(`[AjaxHandler] Error: ${status}`, error);

                if (attempt < retries) {
                    return new Promise(res => setTimeout(res, delay)).then(makeRequest);
                } else {
                    if (options.error) options.error(xhr, status, error);
                    return Promise.reject({ xhr, status, error });
                }
            });
        };

        return makeRequest().finally(() => {
            if (options.finally) options.finally();
        });
    }
}

class UIHelper {
    static showLoading(selector) {
        $(selector).addClass('loading');
    }

    static hideLoading(selector) {
        $(selector).removeClass('loading');
    }

    static toast(message, type = 'info') {
        const colors = { info: 'bg-info', success: 'bg-success', warning: 'bg-warning', error: 'bg-danger' };
        const toast = $(`
            <div class="toast align-items-center text-white ${colors[type] || colors.info} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `);
        $('#toast-container').append(toast);
        const bsToast = new bootstrap.Toast(toast[0]);
        bsToast.show();
    }

    static serializeForm(selector) {
        const formArray = $(selector).serializeArray();
        const data = {};
        formArray.forEach(item => { data[item.name] = item.value; });
        return data;
    }

    static disableButton(selector) {
        $(selector).attr('disabled', true);
    }

    static enableButton(selector) {
        $(selector).attr('disabled', false);
    }
}

class GlobalEvents {
    constructor() {
        this.ajax = new AjaxHandler({ debug: true });
        this.bindEvents();
    }

    bindEvents() {
        const self = this;

        // AJAX GET
        $(document).on('click', '[data-ajax-get]', function(e){
            e.preventDefault();
            const url = $(this).attr('href');
            const target = $(this).data('target');
            UIHelper.showLoading(target);

            self.ajax.get(url, {}, {
                success: (res) => {
                    if(res.success) {
                        $(target).html(res.data || '');
                        if(res.message) UIHelper.toast(res.message, 'success');
                    } else {
                        UIHelper.toast(res.message || 'Failed to load content', 'error');
                    }
                },
                error: () => UIHelper.toast('Failed to load content', 'error'),
                finally: () => UIHelper.hideLoading(target)
            });
        });

        // AJAX POST
        $(document).on('submit', 'form[data-ajax-post]', function(e){
            e.preventDefault();
            const form = $(this);
            const url = form.attr('action');
            const data = UIHelper.serializeForm(this);
            const target = form.data('target');

            UIHelper.showLoading(target);
            UIHelper.disableButton(form.find('button[type="submit"]'));

            self.ajax.post(url, data, {
                success: (res) => {
                    if(res.success) {
                        if(res.html) $(target).html(res.html);
                        if(res.message) UIHelper.toast(res.message, 'success');
                    } else {
                        UIHelper.toast(res.message || 'Submission failed', 'error');
                    }
                },
                error: () => UIHelper.toast('Submission failed', 'error'),
                finally: () => {
                    UIHelper.hideLoading(target);
                    UIHelper.enableButton(form.find('button[type="submit"]'));
                }
            });
        });
    }
}

$(document).ready(function () {
    window.App = new GlobalEvents();

    if($('#toast-container').length === 0){
        $('body').append('<div id="toast-container" class="position-fixed top-0 end-0 p-3" style="z-index:1100;"></div>');
    }
});
