#!/usr/bin/env python3
"""
Setup script for Voice-Based AI Mental Health Screening Assistant
Automates the creation of Python virtual environment and dependency installation
"""

import os
import sys
import subprocess
import platform

def run_command(command, cwd=None):
    """Run a command and return success status"""
    try:
        result = subprocess.run(command, shell=True, cwd=cwd, check=True, 
                              capture_output=True, text=True)
        print(f"✅ {command}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {command}")
        print(f"Error: {e.stderr}")
        return False

def main():
    """Main setup function"""
    print("🚀 Setting up Voice-Based AI Mental Health Screening Assistant")
    print("=" * 60)
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        sys.exit(1)
    
    print(f"✅ Python {sys.version.split()[0]} detected")
    
    # Create backend directory if it doesn't exist
    backend_dir = "backend"
    if not os.path.exists(backend_dir):
        print(f"❌ Backend directory '{backend_dir}' not found")
        sys.exit(1)
    
    # Create virtual environment
    print("\n📦 Creating Python virtual environment...")
    venv_command = f"python -m venv {os.path.join(backend_dir, 'venv')}"
    if not run_command(venv_command):
        print("❌ Failed to create virtual environment")
        sys.exit(1)
    
    # Determine activation script path based on OS
    if platform.system() == "Windows":
        activate_script = os.path.join(backend_dir, "venv", "Scripts", "activate")
        pip_path = os.path.join(backend_dir, "venv", "Scripts", "pip")
    else:
        activate_script = os.path.join(backend_dir, "venv", "bin", "activate")
        pip_path = os.path.join(backend_dir, "venv", "bin", "pip")
    
    # Install dependencies
    print("\n📚 Installing Python dependencies...")
    requirements_file = os.path.join(backend_dir, "requirements.txt")
    
    if os.path.exists(requirements_file):
        install_command = f"{pip_path} install -r requirements.txt"
        if not run_command(install_command, cwd=backend_dir):
            print("❌ Failed to install dependencies")
            sys.exit(1)
    else:
        print(f"⚠️  Requirements file not found: {requirements_file}")
    
    # Create .env file if it doesn't exist
    env_file = os.path.join(backend_dir, ".env")
    env_example = os.path.join(backend_dir, ".env.example")
    
    if not os.path.exists(env_file) and os.path.exists(env_example):
        print("\n⚙️  Creating .env file from template...")
        try:
            with open(env_example, 'r') as src, open(env_file, 'w') as dst:
                dst.write(src.read())
            print("✅ Created .env file - please edit with your configuration")
        except Exception as e:
            print(f"❌ Failed to create .env file: {e}")
    
    # Setup complete
    print("\n" + "=" * 60)
    print("🎉 Setup complete!")
    print("\n📋 Next steps:")
    print("1. Edit backend/.env file with your Gemini API key")
    print("2. Start the backend server:")
    
    if platform.system() == "Windows":
        print("   cd backend")
        print("   venv\\Scripts\\activate")
        print("   python app.py")
    else:
        print("   cd backend")
        print("   source venv/bin/activate")
        print("   python app.py")
    
    print("\n3. In another terminal, serve the frontend:")
    print("   cd frontend")
    print("   python -m http.server 3000")
    print("\n4. Open http://localhost:3000 in your browser")
    print("\n⚠️  Remember: This is not a diagnostic tool!")

if __name__ == "__main__":
    main()