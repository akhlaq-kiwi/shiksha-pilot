#!/usr/bin/env python3
"""
Seed Script for ShikshaPilot School Data
Adds teachers and students across all classes with realistic, unique data.

Usage:
  python seed_school_data.py --url https://qa.shikshapilot.com --phone 1112223333 --password Test@123 --teachers 10 --new-students 5 --existing-students 5
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

# Predefined realistic datasets for varied data generation
MALE_FIRST_NAMES = [
    "Aarav", "Vihaan", "Vivaan", "Advik", "Kabir", "Ishaan", "Reyansh", "Mohammed",
    "Sai", "Arjun", "Aryan", "Ayush", "Dhruv", "Shaurya", "Utkarsh", "Shivam",
    "Yash", "Parth", "Harsh", "Kunal", "Rohit", "Aman", "Alok", "Nikhil",
    "Manish", "Vikas", "Deepak", "Saurabh", "Rohan", "Aditya", "Varun", "Karan",
    "Gaurav", "Ankit", "Rahul", "Mayank", "Abhishek", "Prateek", "Tarun", "Naveen",
    "Praveen", "Ashish", "Sachin", "Sumit", "Ajay", "Vijay", "Sanjay", "Rajesh",
    "Sunil", "Anil"
]

FEMALE_FIRST_NAMES = [
    "Ananya", "Diya", "Riya", "Aadhya", "Saanvi", "Kiara", "Pari", "Anika",
    "Navya", "Angel", "Prisha", "Myra", "Sara", "Shanaya", "Riddhi", "Sneha",
    "Tanvi", "Shreya", "Ishita", "Meera", "Bhavya", "Pooja", "Divya", "Neha",
    "Kavita", "Swati", "Rashmi", "Komal", "Simran", "Nisha", "Pallavi", "Preeti",
    "Ritu", "Sonam", "Priyanka", "Deepika", "Shweta", "Monika", "Suman", "Vandana",
    "Jyoti", "Meenakshi", "Sunita", "Reena", "Anita", "Geeta", "Seema", "Rekha",
    "Sarita", "Usha"
]

MIDDLE_NAMES = ["Kumar", "Singh", "Chandra", "Prasad", "Lal", "Nath", "Kant", "Raj", "Mohan", "Mani"]

LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Singh", "Mishra", "Joshi", "Yadav", "Patel",
    "Tiwari", "Dubey", "Chauhan", "Saxena", "Agarwal", "Pandey", "Tripathi",
    "Srivastava", "Shukla", "Bhatt", "Sen", "Roy", "Bhardwaj", "Choudhary",
    "Mehta", "Bansal", "Goel", "Garg", "Kapoor", "Khurana", "Malhotra", "Bhatia"
]

SUBJECTS = [
    "Mathematics", "Science", "English", "Hindi", "Social Studies",
    "Physics", "Chemistry", "Biology", "Computer Science", "Physical Education"
]

BLOOD_GROUPS = ["A+", "B+", "O+", "AB+", "A-", "B-", "O-"]
CATEGORIES = ["General", "OBC", "SC", "ST"]
RELIGIONS = ["Hindu", "Muslim", "Sikh", "Christian", "Jain"]

OCCUPATIONS = [
    "Business", "Govt Service", "Private Service", "Engineer", "Doctor",
    "Teacher", "Advocate", "Accountant", "Banker", "Architect", "Consultant"
]

COLONIES = [
    "Green Park Colony", "Model Town", "Civil Lines", "Suraj Nagar",
    "Shastri Nagar", "Gandhi Nagar", "Vikas Puri", "Ashok Vihar",
    "Rajendra Nagar", "Indira Enclave", "Mayur Vihar", "Rohini Sector 7"
]

CITIES = ["New Delhi", "Noida", "Gurugram", "Ghaziabad", "Faridabad", "Jaipur", "Lucknow", "Indore"]


def make_request(url, method="GET", payload=None, token=None):
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"error": err_body}
    except Exception as e:
        return 500, {"error": str(e)}


def login(base_url, phone, password):
    url = f"{base_url.rstrip('/')}/api/auth/login"
    status, res = make_request(url, method="POST", payload={"phone": phone, "password": password})
    if status == 200 and "data" in res and "token" in res["data"]:
        user = res["data"].get("user", {})
        name = user.get("name", "Admin")
        school_id = user.get("school_id")
        role = (user.get("role") or "").upper()
        print(f"[OK] Logged in successfully as {name}")
        print(f"     School ID: {school_id}, Role: {role}")
        
        if role not in ["SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"]:
            print(f"\n[ERROR] Current user '{name}' has role '{role}'.")
            print(f"        This data seeding script requires School Admin credentials to add teachers and students.")
            print(f"        Please run the script with School Admin's phone number (e.g. --phone 9998887776).")
            sys.exit(1)

        return res["data"]["token"]
    else:
        print(f"[FAIL] Login failed ({status}): {res}")
        sys.exit(1)


def get_classes(base_url, token):
    url = f"{base_url.rstrip('/')}/api/school/classes"
    status, res = make_request(url, method="GET", token=token)
    if status == 200 and "data" in res:
        classes = res["data"]
        print(f"[OK] Retrieved {len(classes)} classes from school.")
        for c in classes:
            sec = f" - Section {c.get('section')}" if c.get('section') else ""
            print(f"     - Class ID {c.get('id')}: {c.get('name')}{sec}")
        return classes
    else:
        print(f"[FAIL] Failed to fetch classes ({status}): {res}")
        sys.exit(1)


def seed_teachers(base_url, token, count=10):
    print(f"\n==========================================")
    print(f" SEEDING {count} TEACHERS")
    print(f"==========================================")
    url = f"{base_url.rstrip('/')}/api/school/staff"

    created = 0
    for i in range(1, count + 1):
        idx = i - 1
        sub = SUBJECTS[idx % len(SUBJECTS)]
        first_name = (MALE_FIRST_NAMES if i % 2 == 1 else FEMALE_FIRST_NAMES)[idx % 40]
        mid_name = MIDDLE_NAMES[idx % len(MIDDLE_NAMES)]
        last_name = LAST_NAMES[idx % len(LAST_NAMES)]
        teacher_name = f"{first_name} {mid_name} {last_name}"

        f_first = MALE_FIRST_NAMES[(idx + 5) % 40]
        father_name = f"{f_first} {mid_name} {last_name}"
        m_first = FEMALE_FIRST_NAMES[(idx + 5) % 40]
        mother_name = f"{m_first} Devi"

        phone = f"98200{i:05d}"
        emergency_phone = f"98210{i:05d}"
        email = f"teacher{i:02d}.sp@shikshapilot.com"

        colony = COLONIES[idx % len(COLONIES)]
        city = CITIES[idx % len(CITIES)]
        address = f"House {100 + i}, {colony}"

        payload = {
            "name": teacher_name,
            "role": "Teacher",
            "department": sub,
            "email": email,
            "phone": phone,
            "photo_path": None,
            "father_name": father_name,
            "mother_name": mother_name,
            "salary": 1000,
            "emergency_phone": emergency_phone,
            "joining_date": "2026-09-01",
            "exit_date": None,
            "status": "ACTIVE",
            "current_address_line": address,
            "current_city": city,
            "current_state": "Delhi",
            "current_country": "India",
            "current_pin_code": f"1100{i:02d}",
            "permanent_address_line": address,
            "permanent_city": city,
            "permanent_state": "Delhi",
            "permanent_country": "India",
            "permanent_pin_code": f"1100{i:02d}",
            "same_as_current": 1
        }

        status, res = make_request(url, method="POST", payload=payload, token=token)
        if status in (200, 201):
            created += 1
            t_id = res.get("data", {}).get("id")
            emp_id = res.get("data", {}).get("employee_id")
            print(f"[{created}/{count}] Added Teacher: {teacher_name} ({emp_id}) | Subject: {sub} | Phone: {phone} | Salary: 1000")
        else:
            print(f"[FAIL] Teacher {i} ({teacher_name}) failed ({status}): {res}")

    print(f"\n[DONE] Successfully seeded {created}/{count} teachers.")
    return created


def seed_students(base_url, token, classes, new_students_per_class=5, existing_students_per_class=5):
    students_per_class = new_students_per_class + existing_students_per_class
    total_to_create = len(classes) * students_per_class
    print(f"\n==========================================")
    print(f" SEEDING {total_to_create} STUDENTS ({students_per_class} PER CLASS: {new_students_per_class} NEW, {existing_students_per_class} EXISTING)")
    print(f"==========================================")
    url = f"{base_url.rstrip('/')}/api/school/students"

    global_sr = 1
    total_created = 0

    for c_idx, cls in enumerate(classes):
        class_id = cls.get("id")
        class_name = cls.get("name")
        sec_name = f" ({cls.get('section')})" if cls.get("section") else ""
        print(f"\n--- Class {class_name}{sec_name} (ID: {class_id}) ---")

        # Age based on class index (Class 1 -> ~2020 birth, Class 5 -> ~2016 birth)
        birth_year = 2020 - c_idx

        # Build exact ordered list of categories for this class: New Admissions first, then Existing Students
        class_categories = (
            ["New Admission"] * new_students_per_class
            + ["Existing Student"] * existing_students_per_class
        )

        for roll, student_category in enumerate(class_categories, start=1):
            is_male = (roll % 2 == 1)
            first_name = (MALE_FIRST_NAMES if is_male else FEMALE_FIRST_NAMES)[(global_sr - 1) % 50]
            mid_name = MIDDLE_NAMES[(global_sr - 1) % len(MIDDLE_NAMES)]
            last_name = LAST_NAMES[(global_sr - 1) % len(LAST_NAMES)]
            gender = "Male" if is_male else "Female"

            # Month and day
            b_month = (global_sr % 12) + 1
            b_day = (global_sr % 28) + 1
            dob = f"{birth_year}-{b_month:02d}-{b_day:02d}"

            blood = BLOOD_GROUPS[(global_sr - 1) % len(BLOOD_GROUPS)]
            category = CATEGORIES[(global_sr - 1) % len(CATEGORIES)]
            religion = RELIGIONS[(global_sr - 1) % len(RELIGIONS)]

            # 12-digit Aadhaar & 10-digit mobile
            aadhaar_no = f"7000{global_sr:08d}"
            student_mobile = f"98300{global_sr:05d}"
            student_email = f"student{global_sr:03d}.sp@shikshapilot.com"

            # Parents
            f_first = MALE_FIRST_NAMES[(global_sr + 7) % 50]
            father_name = f"{f_first} {mid_name} {last_name}"
            m_first = FEMALE_FIRST_NAMES[(global_sr + 7) % 50]
            mother_name = f"{m_first} Devi"
            occupation = OCCUPATIONS[(global_sr - 1) % len(OCCUPATIONS)]

            # Address
            colony = COLONIES[(global_sr - 1) % len(COLONIES)]
            city = CITIES[(global_sr - 1) % len(CITIES)]
            address = f"House {200 + global_sr}, {colony}"
            pin_code = f"1100{(global_sr % 90) + 10:02d}"

            # Note: admission_fee is intentionally omitted; backend auto-applies configured Admission Fee to New Admissions
            payload = {
                "first_name": first_name,
                "middle_name": mid_name,
                "last_name": last_name,
                "gender": gender,
                "dob": dob,
                "blood_group": blood,
                "category": category,
                "religion": religion,
                "aadhaar_no": aadhaar_no,
                "student_mobile": student_mobile,
                "student_email": student_email,
                "class_id": class_id,
                "roll_no": str(roll),
                "sr_no": str(global_sr),
                "admission_date": "2026-04-01",
                "student_category": student_category,
                "status": "ACTIVE",
                "exit_date": None,
                "father_name": father_name,
                "mother_name": mother_name,
                "parent_occupation": occupation,
                "current_address_line": address,
                "current_city": city,
                "current_state": "Delhi",
                "current_country": "India",
                "current_pin_code": pin_code,
                "permanent_address_line": address,
                "permanent_city": city,
                "permanent_state": "Delhi",
                "permanent_country": "India",
                "permanent_pin_code": pin_code,
                "same_as_current": 1
            }

            status, res = make_request(url, method="POST", payload=payload, token=token)
            if status in (200, 201):
                total_created += 1
                s_id = res.get("data", {}).get("id")
                print(f"  [SR #{global_sr:02d}] {first_name} {last_name} | Roll: {roll} | Category: {student_category} | ID: {s_id}")
            else:
                print(f"  [FAIL] SR #{global_sr:02d} ({first_name} {last_name}) failed ({status}): {res}")

            global_sr += 1

    print(f"\n[DONE] Successfully seeded {total_created}/{total_to_create} students across {len(classes)} classes.")
    return total_created


def main():
    parser = argparse.ArgumentParser(description="Seed ShikshaPilot School Data (Teachers & Students)")
    parser.add_argument("--url", default="http://localhost:3000", help="Base URL of application / API (e.g. http://localhost:3000 or https://qa.shikshapilot.com)")
    parser.add_argument("--phone", default="9998887776", help="School Admin Phone / Username")
    parser.add_argument("--password", default="Test@123", help="School Admin Password")
    parser.add_argument("--teachers", type=int, default=10, help="Number of teachers to add (default: 10)")
    parser.add_argument("--students-per-class", type=int, default=None, help="Total students per class (auto-split 50/50 if --new-students / --existing-students not specified)")
    parser.add_argument("--new-students", type=int, default=None, help="Number of New Admission students per class")
    parser.add_argument("--existing-students", type=int, default=None, help="Number of Existing Student students per class")

    args = parser.parse_args()

    if args.new_students is not None or args.existing_students is not None:
        new_count = args.new_students if args.new_students is not None else 0
        existing_count = args.existing_students if args.existing_students is not None else 0
    else:
        total_per_class = args.students_per_class if args.students_per_class is not None else 10
        new_count = (total_per_class + 1) // 2
        existing_count = total_per_class // 2

    if args.teachers < 0 or new_count < 0 or existing_count < 0:
        print("[ERROR] Counts (--teachers, --new-students, --existing-students) cannot be negative.")
        sys.exit(1)

    total_students_per_class = new_count + existing_count

    print("================================================================")
    print(" SHIKSHAPILOT AUTOMATED DATA FEEDING SCRIPT")
    print("================================================================")
    print(f" Target URL                : {args.url}")
    print(f" Admin Credentials         : Phone={args.phone}, Password={'*' * len(args.password)}")
    print(f" Teachers to add           : {args.teachers}")
    print(f" New Students / Class      : {new_count}")
    print(f" Existing Students / Class : {existing_count}")
    print(f" Total Students / Class    : {total_students_per_class}")
    print("================================================================\n")

    token = login(args.url, args.phone, args.password)
    classes = get_classes(args.url, token)

    if not classes and total_students_per_class > 0:
        print("[FAIL] No classes found in the school. Please create classes first.")
        sys.exit(1)

    if args.teachers > 0:
        seed_teachers(args.url, token, count=args.teachers)
    if total_students_per_class > 0:
        seed_students(
            args.url,
            token,
            classes,
            new_students_per_class=new_count,
            existing_students_per_class=existing_count,
        )

    print("\n================================================================")
    print(" ALL DATA CREATION COMPLETED SUCCESSFULLY!")
    print("================================================================")


if __name__ == "__main__":
    main()

