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
   Create `.env` files in each service directory with the required environment variables. Refer to the `.env.example` files in each service for reference.

4. **Database Setup**
   - Create a MySQL database
   - Update the database credentials in the respective `.env` files
   - Run migrations:
     ```bash
     # From each service directory
     npx sequelize db:migrate
     ```

### Running the Application

1. **Start each service in separate terminals**
   ```bash
   # Terminal 1 - API Gateway
   cd API_Gateway
   npm start

   # Terminal 2 - Auth Service
   cd ../AuthService
   npm start

   # Terminal 3 - Booking Service
   cd ../BookingService
   npm start

   # Terminal 4 - Flights & Search Service
   cd ../FlightsAndSearchService
   npm start
   ```

2. **Access the API**
   The API Gateway will be available at `http://localhost:3000`

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

To run the application using Docker:

```bash
# Build and start all services
docker-compose up --build

# Stop all services
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
