# Airline Booking System (Backend)

A microservices-based backend system for an airline booking platform, built with Node.js, Express, and MySQL.

## 🚀 Features

- **User Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control
  - Secure password hashing

- **Flight Management**
  - Flight search and filtering
  - Airport and city management
  - Real-time seat availability

- **Booking System**
  - Multi-step booking process
  - Seat selection
  - Booking confirmation
  - Payment integration

- **Notification Service**
  - Booking confirmations
  - Payment receipts
  - Flight reminders

## 🛠 Tech Stack

- **Backend Framework**: Node.js with Express.js
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT (JSON Web Tokens)
- **API Gateway**: Express Gateway
- **Message Broker**: RabbitMQ/Kafka (for async communication)
- **Containerization**: Docker
- **Testing**: Jest, Supertest

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- MySQL Server
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/khushalbansal02/airline--backend-system.git
   cd airline--backend-system
   ```

2. **Install dependencies for each service**
   ```bash
   # Install API Gateway dependencies
   cd API_Gateway
   npm install
   
   # Install Auth Service dependencies
   cd ../AuthService
   npm install
   
   # Install Booking Service dependencies
   cd ../BookingService
   npm install
   
   # Install Flights & Search Service dependencies
   cd ../FlightsAndSearchService
   npm install
   
   # Install Reminder Service dependencies (optional)
   cd ../ReminderService
   npm install
   ```

3. **Set up environment variables**
   `.env` files have been created in each service directory with default values:
   - `AuthService/.env` - Port: 3001, JWT_KEY configured
   - `BookingService/.env` - Port: 3002, Flight service path and RabbitMQ configured
   - `FlightsAndSearchService/.env` - Port: 3003, DB sync enabled
   - `ReminderService/.env` - Port: 3004, Email and RabbitMQ configured
   
   Update these files with your actual credentials if needed.

4. **Database Configuration**
   Database config files (`src/config/config.json`) have been created for each service with default credentials:
   - Username: `airline_user`
   - Password: `airline_pass`
   - Databases: `auth_service_dev`, `booking_service_dev`, `flights_service_dev`, `reminder_service_dev`

5. **MySQL Database Setup**
   Start MySQL and create the databases and user:
   ```bash
   sudo mysql
   ```
   Then run the following SQL commands:
   ```sql
   CREATE DATABASE auth_service_dev;
   CREATE DATABASE booking_service_dev;
   CREATE DATABASE flights_service_dev;
   CREATE DATABASE reminder_service_dev;
   CREATE USER 'airline_user'@'localhost' IDENTIFIED BY 'airline_pass';
   GRANT ALL PRIVILEGES ON *.* TO 'airline_user'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

6. **Run Migrations**
   Create tables in each service database by running migrations:
   ```bash
   # Auth Service
   cd AuthService
   npx sequelize db:migrate --config src/config/config.json --models-path src/models --migrations-path src/migrations
   
   # Booking Service
   cd ../BookingService
   npx sequelize db:migrate --config src/config/config.json --models-path src/models --migrations-path src/migrations
   
   # Flights & Search Service
   cd ../FlightsAndSearchService
   npx sequelize db:migrate --config src/config/config.json --models-path src/models --migrations-path src/migrations
   
   # Reminder Service
   cd ../ReminderService
   npx sequelize db:migrate --config src/config/config.json --models-path src/models --migrations-path src/migrations
   ```

7. **Seed Dummy Data**
   Load seeded test data for each service:
   ```bash
   cd AuthService
   npx sequelize db:seed:all --config src/config/config.json --models-path src/models --seeders-path src/seeders
   
   cd ../BookingService
   npx sequelize db:seed:all --config src/config/config.json --models-path src/models --seeders-path src/seeders
   
   cd ../FlightsAndSearchService
   npx sequelize db:seed:all --config src/config/config.json --models-path src/models --seeders-path src/seeders
   
   cd ../ReminderService
   npx sequelize db:seed:all --config src/config/config.json --models-path src/models --seeders-path src/seeders
   ```

### Running the Application

1. **Start each service in separate terminals**
   ```bash
   # Terminal 1 - Auth Service
   cd AuthService
   npm start
   
   # Terminal 2 - Flights & Search Service
   cd ../FlightsAndSearchService
   npm start
   
   # Terminal 3 - Booking Service
   cd ../BookingService
   npm start
   
   # Terminal 4 - Reminder Service
   cd ../ReminderService
   npm start
   
   # Terminal 5 - API Gateway
   cd ../API_Gateway
   npm start
   ```

2. **Service Ports**
   - Auth Service: `http://localhost:3001`
   - Booking Service: `http://localhost:3002`
   - Flights & Search Service: `http://localhost:3003`
   - Reminder Service: `http://localhost:3004`
   - API Gateway: `http://localhost:3006`

3. **Access the API**
   Use the API Gateway at `http://localhost:3006` for all requests. The gateway will proxy and authenticate requests to the appropriate microservice.

## ⚙️ Service Configuration

### Environment Files
All services have been pre-configured with `.env` files in their respective directories. Key configurations:

- **AuthService/.env**: JWT secret, port, and database sync settings
- **BookingService/.env**: Flight service path, message broker URL, and RabbitMQ exchange/binding keys
- **FlightsAndSearchService/.env**: Database sync enabled, port configuration
- **ReminderService/.env**: Email credentials, message broker configuration, port settings

### Database Configuration
Each service has `src/config/config.json` configured to use:
- Host: `127.0.0.1`
- Dialect: `mysql`
- User: `airline_user`
- Password: `airline_pass`

**Note**: Keep `src/config/config.json` files out of version control if they contain real credentials (already in `.gitignore`).

### Message Broker (RabbitMQ)
The system uses RabbitMQ for async communication between services:
- **BookingService** publishes booking events to the message broker
- **ReminderService** subscribes to booking events and sends email notifications

Ensure RabbitMQ is running on `localhost:5672` (the default), or update `MESSAGE_BROKER_URL` in the `.env` files accordingly.

### Email Notifications
The ReminderService sends email notifications using Gmail SMTP. Update `.env`:
- `EMAIL_ID`: Your Gmail address
- `EMAIL_PASS`: Your Gmail app password (not your regular password)

## 📚 API Documentation

### Authentication

- `POST /api/v1/signup` - Register a new user
- `POST /api/v1/signin` - User login
- `GET /api/v1/isAuthenticated` - Check authentication status

### Flights

- `GET /api/v1/flights` - Search flights
- `GET /api/v1/flights/:id` - Get flight details

### Bookings

- `POST /api/v1/bookings` - Create a new booking
- `GET /api/v1/bookings/:id` - Get booking details
- `PUT /api/v1/bookings/:id/cancel` - Cancel a booking

## 🐳 Docker Support

The provided `docker-compose.yml` currently runs only RabbitMQ as the message broker. The service processes themselves are expected to run locally using `npm start` from each service directory.

To start RabbitMQ:

```bash
docker-compose up
```

To stop RabbitMQ:

```bash
docker-compose down
```

## 🧪 Testing

Run tests for each service:

```bash
# From each service directory
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

[Your Name]
- GitHub: [@khushalbansal02](https://github.com/khushalbansal02)

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/)
- [Sequelize](https://sequelize.org/)
- [JWT](https://jwt.io/)
- And all the amazing open-source libraries used in this project
