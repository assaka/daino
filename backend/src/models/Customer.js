const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');
const bcrypt = require('bcryptjs');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  store_id: {
    type: DataTypes.UUID,
    allowNull: true, // Make optional for multi-store authentication
    references: {
      model: 'stores',
      key: 'id'
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true // Allow null for guest customers created from orders
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING(10),
    allowNull: true,
    validate: {
      isIn: [['male', 'female', 'other', 'prefer_not_to_say', null]]
    }
  },
  avatar_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  total_spent: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  total_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_order_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  email_verification_token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  password_reset_token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  password_reset_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'customer',
    allowNull: false
  },
  account_type: {
    type: DataTypes.STRING,
    defaultValue: 'individual',
    allowNull: false
  },
  customer_type: {
    type: DataTypes.STRING,
    defaultValue: 'guest',
    allowNull: false,
    validate: {
      isIn: [['guest', 'registered']]
    }
  },
  is_blacklisted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  blacklist_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  blacklisted_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'customers',
  indexes: [
    {
      unique: true,
      fields: ['email'], // Unique email across all customers
      name: 'unique_customer_email'
    }
  ],
  hooks: {
    beforeCreate: async (customer) => {
      if (customer.password) {
        customer.password = await bcrypt.hash(customer.password, 10);
        // Set customer_type to registered if password is provided
        if (!customer.customer_type) {
          customer.customer_type = 'registered';
        }
      }
    },
    beforeUpdate: async (customer) => {
      if (customer.changed('password')) {
        customer.password = await bcrypt.hash(customer.password, 10);
        // Update customer_type to registered when password is added
        if (customer.password && customer.customer_type !== 'registered') {
          customer.customer_type = 'registered';
        }
      }
    }
  }
});

// Add authentication methods
Customer.prototype.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

Customer.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.email_verification_token;
  delete values.password_reset_token;
  delete values.password_reset_expires;
  return values;
};

module.exports = Customer;