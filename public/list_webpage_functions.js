
function fetchData() {
    $.ajax({
        type: 'POST',
        url: '../endpoints/lista',
        success: function (response) {
            var dataList = $('#dataList');
            dataList.empty();
            let date1, date2;
            if (response.error) {
                $('#errorBanner').text(response.error).show();
                return;
            }
            $('#errorBanner').text(response.error).show();
            response.forEach(function (item) {
                console.log(item.Inizio);
                var listItem = $('<tr></tr>');
                date1 = new Date(item.Inizio).toISOString().split('T')[0];
                date2 = new Date(item.Fine).toISOString().split('T')[0];
                listItem.append('<td>' + item.Nome + '</td>');
                listItem.append('<td>' + item.Targa + '</td>');
                listItem.append('<td>' + date1 + '</td>');
                listItem.append('<td>' + date2 + '</td>');
                listItem.append('<td>' + item.Colonnine + '</td>');
                var button = $('<button></button>').addClass('btn btn-primary');
                button.attr({
                    'type': 'button',
                    'class': 'btn btn-link',
                    'data-bs-toggle': 'modal',
                    'data-bs-target': '#editModal'
                });
                button.attr('data-nome', item.Nome);
                button.attr('data-targa', item.Targa);
                button.attr('data-inizio', date1);
                button.attr('data-fine', date2);
                button.attr('data-colonnina', item.Colonnine);

                button.on('click', function () {
                    $('#modalNome').val($(this).attr('data-nome'));
                    $('#modalTarga').val($(this).attr('data-targa'));
                    $('#modalInizio').val($(this).attr('data-inizio'));
                    $('#modalFine').val($(this).attr('data-fine'));
                    $('#modalColonnina').val($(this).attr('data-colonnina'));
                    selectCar(item.Colonnine);
                    sendAjaxRequest();
                });
                var icon = $('<i></i>').addClass('fas fa-pen');
                button.append(icon);
                listItem.append($('<td></td>').append(button));
                $('#dataList').append(listItem);
            });
        },
        error: function (xhr, status, error) {
            console.error('Errore nella richiesta AJAX:', status, error);
        }
    });
}

$(document).ready(function () {
    fetchData();
});

function validateForm() {
    var name = document.getElementById('modalNome').value;
    var selectedCar = document.getElementById('selectedCar').value;
    if (name.length > 20) {
        errorMessage = 'Il nome non può avere più di 20 caratteri.';
        document.getElementById('nameError').innerText = errorMessage;
        return false;
    }
    else { document.getElementById('nameError').innerText = ''; }
    if (!selectedCar) {
        errorMessage = 'Selezionare una colonnina prima di confermare.';
        document.getElementById('chargingError').innerText = errorMessage;
        return false; // blocca l'invio del modulo
    }
    return true; // consente l'invio del modulo
}

function checkDates() {
    var startDate = new Date(document.getElementById('modalInizio').value);
    var endDate = new Date(document.getElementById('modalFine').value);
    var today = new Date();
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    clearSelection();

    var dateError = document.getElementById('dateError');

    if (startDate > endDate) {
        dateError.innerText = 'La data di inizio non può essere successiva alla data di fine';
        return false;
    } else if (endDate - startDate > 30 * 24 * 60 * 60 * 1000) {
        dateError.innerText = 'La durata non può superare un mese';
        return false;
    } else if (startDate < yesterday || endDate < yesterday) {
        dateError.innerText = 'Le date non possono essere nel passato';
        return false;
    } else {
        dateError.innerText = ''; // Clear error message
    }
}
// Funzione per rimuovere la selezione delle colonnine quando si cambia la data
function clearSelection() {
    document.querySelectorAll('.car-icon').forEach(container => {
        container.classList.remove('selected');
    });

    document.getElementById('selectedCar').value = '';
}

// Funzione per ordinare e rimuovere i duplicati dall'array
function sortAndRemoveDuplicates(array) {
    return [...new Set(array)].sort();
}

// Funzione per disabilitare le colonnine non disponibili
function disableUnavailableCars(unavailableCars) {
    unavailableCars = sortAndRemoveDuplicates(unavailableCars);
    console.log(unavailableCars);
    document.querySelectorAll('.car-icon').forEach(function (carIcon) {
        var iconNumberElement = carIcon.querySelector('.icon-number');
        if (iconNumberElement) {
            var carNumber = parseInt(iconNumberElement.textContent.trim(), 10);
            if (unavailableCars.includes(carNumber)) {
                carIcon.classList.add('unavailable');
                carIcon.setAttribute('data-disponibile', 'false');
                carIcon.classList.remove('selected');
                carIcon.onclick = null;
            } else {
                carIcon.classList.remove('unavailable');
                carIcon.setAttribute('data-disponibile', 'true');
                carIcon.onclick = function () {
                    selectCar(carNumber);
                };
            }
        }
    });
}



// Funzione per selezionare una colonnina
function selectCar(carNumber) {
    document.querySelectorAll('.car-icon').forEach(container => {
        container.classList.remove('selected');
    });
    document.querySelector(`.car-icon:nth-child(${carNumber})`).classList.add('selected');
    document.getElementById('selectedCar').value = carNumber;
}

// Funzione per inviare la richiesta AJAX
function sendAjaxRequest() {
    let plate_tmp = document.getElementById('modalTarga').value;
    let start_tmp = document.getElementById('modalInizio').value;
    let end_tmp = document.getElementById('modalFine').value;

    $.ajax({
        type: 'POST',
        url: '../endpoints/check_posti_modal',
        contentType: 'application/json',
        data: JSON.stringify({ plate: plate_tmp, data_arrivo: start_tmp, data_partenza: end_tmp }),
        success: function (response) {
            console.log('Checkposti request inviata');
            var carsUnavailable = [];
            //carsUnavailable = JSON.parse(response)
            carsUnavailable = response;
            disableUnavailableCars(carsUnavailable);
        },
        error: function (xhr, status, error) {
            console.error('Errore nella richiesta AJAX:', status, error);
        }
    });
}

// Funzione per eseguire le operazioni quando si cambia la data di arrivo
function onArrivalDateChange() {
    document.getElementById('modalInizio').value = '';
    sendAjaxRequest();
}

// Funzione per eseguire le operazioni quando si cambia la data di partenza
function onDepartureDateChange() {
    document.getElementById('modalFine').value = '';
    sendAjaxRequest();
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('modalInizio').addEventListener('input', checkDates);
    document.getElementById('modalFine').addEventListener('input', checkDates);
    document.getElementById('modalInizio').addEventListener('input', sendAjaxRequest);
    document.getElementById('modalFine').addEventListener('input', sendAjaxRequest);
});

function sendDeleteRequest(plate) {
    plate_tmp = document.getElementById('modalTarga').value;
    console.log('sending delete request');
    $.ajax({
        type: 'POST',
        url: '../endpoints/delete_targhe',
        contentType: 'application/json',
        data: JSON.stringify({ plate: plate_tmp }),
        success: function (response) {
            console.log('Delete request inviata');
            if (response.error) {
                console.error('errore nella richiesta ajax');
                return;
            }
        },
        error: function (xhr, status, error) {
            console.error('Errore nella richiesta AJAX-Delete:', status, error);
        }
    });
}
function sendChangeRequest() {
    let plate_tmp = document.getElementById('modalTarga').value;
    let name_tmp = document.getElementById('modalNome').value;
    let start_tmp = document.getElementById('modalInizio').value;
    let end_tmp = document.getElementById('modalFine').value;
    let place = document.getElementById('selectedCar').value;
    console.log('updating');

    $.ajax({
        type: 'POST',
        url: '../endpoints/change_targhe',
        contentType: 'application/json',
        data: JSON.stringify({ name: name_tmp, plate: plate_tmp, data_arrivo: start_tmp, data_partenza: end_tmp, selectedCar: place }),
        success: function (response) {
            console.log('Update request inviata');
            if (response.error) {
                console.error('errore nella richiesta ajax');
                return;
            }
        },
        error: function (xhr, status, error) {
            console.error('Errore nella richiesta AJAX-Update:', status, error);
        }
    });
    window.location.reload();
}

function showConfirmModal() {
    // Apri il mini modal di conferma
    $('#confirmModal').modal('show');
}
function confirmDelete() {
    // Chiudi il modal di conferma
    $('#confirmModal').modal('hide');

    // Chiamare la funzione di eliminazione qui, per esempio:
    sendDeleteRequest();

    // Chiudi anche il modal principale
    $('#editModal').modal('hide');
    window.location.reload();
}