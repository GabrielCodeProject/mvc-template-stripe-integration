'use client';

import { useState, useEffect } from 'react';
import { User } from '@/models/User';
import UserList from './UserList';
import UserEditForm from './UserEditForm';

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const result = await response.json();
      
      if (result.success) {
        const userInstances = result.data.map((u: any) => User.fromJSON(u));
        setUsers(userInstances);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditing(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });
      const result = await response.json();

      if (result.success) {
        await fetchUsers();
      } else {
        alert(result.error);
      }
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const handleSave = async (userData: Partial<{
    name: string;
    email: string;
  }>) => {
    try {
      if (selectedUser) {
        const response = await fetch(`/api/users/${selectedUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        });
        const result = await response.json();

        if (!result.success) {
          alert(result.error);
          return;
        }
      } else {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        });
        const result = await response.json();

        if (!result.success) {
          alert(result.error);
          return;
        }
      }

      await fetchUsers();
      setIsEditing(false);
      setSelectedUser(null);
    } catch (err) {
      alert('Failed to save user');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedUser(null);
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return user.name.toLowerCase().includes(searchLower) ||
           user.email.toLowerCase().includes(searchLower);
  });

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your users using our MVC-style architecture with classes
        </p>
      </div>

      {!isEditing ? (
        <>
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
            />
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Add New User
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            {filteredUsers.length > 0 ? (
              <UserList
                users={filteredUsers}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {searchTerm ? 'No users found matching your search' : 'No users found'}
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">User Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Users:</span>
                <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{users.length}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Filtered Results:</span>
                <p className="font-bold text-lg text-blue-600 dark:text-blue-400">{filteredUsers.length}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Last Updated:</span>
                <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <UserEditForm
          user={selectedUser}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}