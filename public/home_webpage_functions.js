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

    document.querySelectorAll('.car-icon').forEach(function (carIcon) {
        var iconNumberElement = carIcon.querySelector('.icon-number');
        if (iconNumberElement) {
            var carNumber = parseInt(iconNumberElement.textContent.trim(), 10);
            console.log(carNumber)
            console.log(unavailableCars)
            if (unavailableCars.includes(carNumber)) {
                console.log('Tolgo le colonnine non disponibili')
                carIcon.classList.add('unavailable');
                carIcon.setAttribute('data-disponibile', 'false');
                carIcon.classList.remove('selected');
                carIcon.onclick = null;
            } else {
                console.log('Rimettere le colonnine disponibili')
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
    var formData = $('#myForm').serialize();

    $.ajax({
        type: 'POST',
        url: '../endpoints/check_posti',
        data: formData,
        success: function (response) {
            console.log('Ajax request inviata');
            //$('#risultati_query').html("Le collonnine non disponibili sono: "+response);
            var carsUnavailable = []
            console.log(response)
            //carsUnavailable = JSON.parse(response)
            carsUnavailable = response
            console.log('Risposta Ricevuta')
            disableUnavailableCars(carsUnavailable);
        },
        error: function (xhr, status, error) {
            console.error('Errore nella richiesta AJAX:', status, error);
        }
    });
}

// Funzione per eseguire le operazioni quando si cambia la data di arrivo
function onArrivalDateChange() {
    document.getElementById('data_partenza').value = '';
    sendAjaxRequest();
}

// Funzione per eseguire le operazioni quando si cambia la data di partenza
function onDepartureDateChange() {
    document.getElementById('data_partenza').value = '';
    sendAjaxRequest();
}

// Funzione per controllare le date inserite
function checkDates() {
    var startDate = new Date(document.getElementById('data_arrivo').value);
    var endDate = new Date(document.getElementById('data_partenza').value);
    var today = new Date();
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    var dateError = document.getElementById('dateError');

    if (startDate > endDate) {
        dateError.innerText = 'La data di inizio non può essere successiva alla data di fine';
    } else if (endDate - startDate > 30 * 24 * 60 * 60 * 1000) {
        dateError.innerText = 'La durata non può superare un mese';
    } else if (startDate < yesterday || endDate < yesterday) {
        dateError.innerText = 'Le date non possono essere nel passato';
    } else {
        dateError.innerText = ''; // Clear error message
    }
}
//compilazione colonnina necessaria per l'invio del modulo
function validateForm() {
    var name = document.getElementById('name').value;
    var plate = document.getElementById('plate').value;
    var selectedCar = document.getElementById('selectedCar').value;
    if (plate.length > 10) {
        errorMessage = 'La targa non può avere più di 10 caratteri.';
        document.getElementById('platehelp').innerText = errorMessage;
        return false;
    }
    else { document.getElementById('platehelp').innerText = ''; }
    if (name.length > 20) {
        errorMessage = 'Il nome non può avere più di 20 caratteri.';
        document.getElementById('namehelp').innerText = errorMessage;
        return false;
    }
    else { document.getElementById('namehelp').innerText = ''; }
    if (!selectedCar) {
        errorMessage = 'Selezionare una colonnina.';
        document.getElementById('carError').innerText = errorMessage;
        return false; // blocca l'invio del modulo
    }
    return true; // consente l'invio del modulo
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('data_arrivo').addEventListener('input', checkDates);
    document.getElementById('data_partenza').addEventListener('input', checkDates);
    document.getElementById('data_arrivo').addEventListener('input', clearSelection);
    document.getElementById('data_partenza').addEventListener('input', clearSelection);
    document.getElementById('data_arrivo').addEventListener('input', sendAjaxRequest);
    document.getElementById('data_partenza').addEventListener('input', sendAjaxRequest);

});