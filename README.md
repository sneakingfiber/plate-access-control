# **Plate Access Control**

A web application and Node.js server for managing a controlled parking lot using license plate recognition.

## **Features**
- **Plate Management**: Add, update, and delete license plates in the system.
- **Relay Control**: Manage charging station relays for vehicles based on reservations.
- **Device Integration**: Communicates with IP cameras and relays using APIs for real-time updates.
- **Date Management**: Automatically enables or disables relays based on the validity of a reservation.
- **Authentication**: Digest authentication is used to securely connect to devices.
- **UI**: Simple web interface for monitoring and controlling the system.

## **Technologies Used**
- **Backend**: Node.js
- **Frontend**: HTML5, Bootstrap
- **Database**: MySQL
- **Device Integration**: Digest Authentication, API calls
- **Version Control**: Git & GitHub

## **Setup Instructions**
1. **Clone the repository**:
   ```bash
   git clone git@github.com:fyder9/plate-access-control.git
   cd plate-access-control
