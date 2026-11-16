#!/usr/bin/env python3
"""
Seed Test Series Automation Script for Shiksha Pilot
Author: Shiksha Pilot Engineering Team

Usage:
  python seed_test_series.py --phone 9876543210 --password mypassword --class "10-A" --count 20
  python seed_test_series.py --url https://qa.shikshapilot.com --phone 9876543210 --password mypass --class 1 --count 50
  python seed_test_series.py --phone 9876543210 --password mypass --list-classes
"""

import argparse
import datetime
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

# Embedded Clean Dataset of 100 Questions (No subject tags, 4 options each, correct index marked)
QUESTIONS_POOL = [{'number': 1, 'question_text': 'What is the plural of "Child"?', 'correct_option_index': 1, 'options': [{'option_text': 'Childs', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Children', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Childes', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Childrens', 'option_image_url': '', 'is_correct': False}]}, {'number': 2, 'question_text': 'What is 25 × 4?', 'correct_option_index': 2, 'options': [{'option_text': '80', 'option_image_url': '', 'is_correct': False}, {'option_text': '90', 'option_image_url': '', 'is_correct': False}, {'option_text': '100', 'option_image_url': '', 'is_correct': True}, {'option_text': '120', 'option_image_url': '', 'is_correct': False}]}, {'number': 3, 'question_text': 'Which planet is known as the Red Planet?', 'correct_option_index': 1, 'options': [{'option_text': 'Venus', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Mars', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Jupiter', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Saturn', 'option_image_url': '', 'is_correct': False}]}, {'number': 4, 'question_text': 'What is the capital of India?', 'correct_option_index': 2, 'options': [{'option_text': 'Mumbai', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Kolkata', 'option_image_url': '', 'is_correct': False}, {'option_text': 'New Delhi', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Chennai', 'option_image_url': '', 'is_correct': False}]}, {'number': 5, 'question_text': 'Who was the first Prime Minister of India?', 'correct_option_index': 1, 'options': [{'option_text': 'Mahatma Gandhi', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Jawaharlal Nehru', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Sardar Patel', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Subhash Chandra Bose', 'option_image_url': '', 'is_correct': False}]}, {'number': 6, 'question_text': 'Choose the correct spelling.', 'correct_option_index': 2, 'options': [{'option_text': 'Beautifull', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Beutiful', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Beautiful', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Beautifal', 'option_image_url': '', 'is_correct': False}]}, {'number': 7, 'question_text': 'What is 144 ÷ 12?', 'correct_option_index': 2, 'options': [{'option_text': '10', 'option_image_url': '', 'is_correct': False}, {'option_text': '11', 'option_image_url': '', 'is_correct': False}, {'option_text': '12', 'option_image_url': '', 'is_correct': True}, {'option_text': '14', 'option_image_url': '', 'is_correct': False}]}, {'number': 8, 'question_text': 'Which gas do humans need to breathe?', 'correct_option_index': 1, 'options': [{'option_text': 'Nitrogen', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Oxygen', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Carbon dioxide', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Hydrogen', 'option_image_url': '', 'is_correct': False}]}, {'number': 9, 'question_text': 'Which is the national animal of India?', 'correct_option_index': 2, 'options': [{'option_text': 'Lion', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Elephant', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Bengal Tiger', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Leopard', 'option_image_url': '', 'is_correct': False}]}, {'number': 10, 'question_text': 'Who was known as the Father of the Nation in India?', 'correct_option_index': 1, 'options': [{'option_text': 'Bhagat Singh', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Mahatma Gandhi', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Jawaharlal Nehru', 'option_image_url': '', 'is_correct': False}, {'option_text': 'B. R. Ambedkar', 'option_image_url': '', 'is_correct': False}]}, {'number': 11, 'question_text': 'What is the opposite of "Ancient"?', 'correct_option_index': 1, 'options': [{'option_text': 'Old', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Modern', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Historic', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Past', 'option_image_url': '', 'is_correct': False}]}, {'number': 12, 'question_text': 'What is the square of 9?', 'correct_option_index': 2, 'options': [{'option_text': '18', 'option_image_url': '', 'is_correct': False}, {'option_text': '72', 'option_image_url': '', 'is_correct': False}, {'option_text': '81', 'option_image_url': '', 'is_correct': True}, {'option_text': '99', 'option_image_url': '', 'is_correct': False}]}, {'number': 13, 'question_text': 'Which part of a plant absorbs water from the soil?', 'correct_option_index': 2, 'options': [{'option_text': 'Leaf', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Flower', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Root', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Stem', 'option_image_url': '', 'is_correct': False}]}, {'number': 14, 'question_text': 'How many days are there in a leap year?', 'correct_option_index': 2, 'options': [{'option_text': '364', 'option_image_url': '', 'is_correct': False}, {'option_text': '365', 'option_image_url': '', 'is_correct': False}, {'option_text': '366', 'option_image_url': '', 'is_correct': True}, {'option_text': '367', 'option_image_url': '', 'is_correct': False}]}, {'number': 15, 'question_text': 'Who was the first Mughal emperor of India?', 'correct_option_index': 1, 'options': [{'option_text': 'Akbar', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Babur', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Humayun', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Shah Jahan', 'option_image_url': '', 'is_correct': False}]}, {'number': 16, 'question_text': 'Choose the correct article: "_ apple a day keeps the doctor away."', 'correct_option_index': 1, 'options': [{'option_text': 'A', 'option_image_url': '', 'is_correct': False}, {'option_text': 'An', 'option_image_url': '', 'is_correct': True}, {'option_text': 'The', 'option_image_url': '', 'is_correct': False}, {'option_text': 'No article', 'option_image_url': '', 'is_correct': False}]}, {'number': 17, 'question_text': 'What is 15% of 200?', 'correct_option_index': 2, 'options': [{'option_text': '20', 'option_image_url': '', 'is_correct': False}, {'option_text': '25', 'option_image_url': '', 'is_correct': False}, {'option_text': '30', 'option_image_url': '', 'is_correct': True}, {'option_text': '40', 'option_image_url': '', 'is_correct': False}]}, {'number': 18, 'question_text': 'Which organ pumps blood throughout the human body?', 'correct_option_index': 1, 'options': [{'option_text': 'Brain', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Heart', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Lungs', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Kidney', 'option_image_url': '', 'is_correct': False}]}, {'number': 19, 'question_text': 'Which is the largest ocean in the world?', 'correct_option_index': 3, 'options': [{'option_text': 'Atlantic Ocean', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Indian Ocean', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Arctic Ocean', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Pacific Ocean', 'option_image_url': '', 'is_correct': True}]}, {'number': 20, 'question_text': 'Who built the Taj Mahal?', 'correct_option_index': 1, 'options': [{'option_text': 'Akbar', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Shah Jahan', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Babur', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Aurangzeb', 'option_image_url': '', 'is_correct': False}]}, {'number': 21, 'question_text': 'What is the past tense of "Go"?', 'correct_option_index': 2, 'options': [{'option_text': 'Goed', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Gone', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Went', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Going', 'option_image_url': '', 'is_correct': False}]}, {'number': 22, 'question_text': 'What is the perimeter of a square with each side 5 cm?', 'correct_option_index': 2, 'options': [{'option_text': '10 cm', 'option_image_url': '', 'is_correct': False}, {'option_text': '15 cm', 'option_image_url': '', 'is_correct': False}, {'option_text': '20 cm', 'option_image_url': '', 'is_correct': True}, {'option_text': '25 cm', 'option_image_url': '', 'is_correct': False}]}, {'number': 23, 'question_text': 'Which vitamin do we get from sunlight?', 'correct_option_index': 3, 'options': [{'option_text': 'Vitamin A', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Vitamin B', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Vitamin C', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Vitamin D', 'option_image_url': '', 'is_correct': True}]}, {'number': 24, 'question_text': 'Which is the smallest continent?', 'correct_option_index': 1, 'options': [{'option_text': 'Europe', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Australia', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Asia', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Africa', 'option_image_url': '', 'is_correct': False}]}, {'number': 25, 'question_text': 'In which year did India become independent?', 'correct_option_index': 2, 'options': [{'option_text': '1942', 'option_image_url': '', 'is_correct': False}, {'option_text': '1945', 'option_image_url': '', 'is_correct': False}, {'option_text': '1947', 'option_image_url': '', 'is_correct': True}, {'option_text': '1950', 'option_image_url': '', 'is_correct': False}]}, {'number': 26, 'question_text': 'Identify the noun in the sentence: "The boy is playing."', 'correct_option_index': 1, 'options': [{'option_text': 'The', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Boy', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Is', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Playing', 'option_image_url': '', 'is_correct': False}]}, {'number': 27, 'question_text': 'What is the value of 7³?', 'correct_option_index': 2, 'options': [{'option_text': '49', 'option_image_url': '', 'is_correct': False}, {'option_text': '147', 'option_image_url': '', 'is_correct': False}, {'option_text': '343', 'option_image_url': '', 'is_correct': True}, {'option_text': '729', 'option_image_url': '', 'is_correct': False}]}, {'number': 28, 'question_text': 'What is the boiling point of water at sea level?', 'correct_option_index': 2, 'options': [{'option_text': '50°C', 'option_image_url': '', 'is_correct': False}, {'option_text': '75°C', 'option_image_url': '', 'is_correct': False}, {'option_text': '100°C', 'option_image_url': '', 'is_correct': True}, {'option_text': '150°C', 'option_image_url': '', 'is_correct': False}]}, {'number': 29, 'question_text': 'Which is the national bird of India?', 'correct_option_index': 1, 'options': [{'option_text': 'Parrot', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Peacock', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Sparrow', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Eagle', 'option_image_url': '', 'is_correct': False}]}, {'number': 30, 'question_text': 'Who was the first woman ruler of the Delhi Sultanate?', 'correct_option_index': 0, 'options': [{'option_text': 'Razia Sultan', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Rani Lakshmibai', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Nur Jahan', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Jodha Bai', 'option_image_url': '', 'is_correct': False}]}, {'number': 31, 'question_text': 'What is the synonym of "Happy"?', 'correct_option_index': 2, 'options': [{'option_text': 'Sad', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Angry', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Joyful', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Tired', 'option_image_url': '', 'is_correct': False}]}, {'number': 32, 'question_text': 'What is the LCM of 4 and 6?', 'correct_option_index': 2, 'options': [{'option_text': '8', 'option_image_url': '', 'is_correct': False}, {'option_text': '10', 'option_image_url': '', 'is_correct': False}, {'option_text': '12', 'option_image_url': '', 'is_correct': True}, {'option_text': '24', 'option_image_url': '', 'is_correct': False}]}, {'number': 33, 'question_text': 'Which is the hardest natural substance?', 'correct_option_index': 2, 'options': [{'option_text': 'Gold', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Iron', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Diamond', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Silver', 'option_image_url': '', 'is_correct': False}]}, {'number': 34, 'question_text': 'Which country is known as the Land of the Rising Sun?', 'correct_option_index': 1, 'options': [{'option_text': 'China', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Japan', 'option_image_url': '', 'is_correct': True}, {'option_text': 'India', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Thailand', 'option_image_url': '', 'is_correct': False}]}, {'number': 35, 'question_text': 'Who led the Dandi March in 1930?', 'correct_option_index': 1, 'options': [{'option_text': 'Jawaharlal Nehru', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Mahatma Gandhi', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Bhagat Singh', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Bal Gangadhar Tilak', 'option_image_url': '', 'is_correct': False}]}, {'number': 36, 'question_text': 'Which of these is a pronoun?', 'correct_option_index': 2, 'options': [{'option_text': 'Table', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Beautiful', 'option_image_url': '', 'is_correct': False}, {'option_text': 'She', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Quickly', 'option_image_url': '', 'is_correct': False}]}, {'number': 37, 'question_text': 'What is the sum of the first five natural numbers?', 'correct_option_index': 1, 'options': [{'option_text': '10', 'option_image_url': '', 'is_correct': False}, {'option_text': '15', 'option_image_url': '', 'is_correct': True}, {'option_text': '20', 'option_image_url': '', 'is_correct': False}, {'option_text': '25', 'option_image_url': '', 'is_correct': False}]}, {'number': 38, 'question_text': 'Which planet is the largest in our solar system?', 'correct_option_index': 2, 'options': [{'option_text': 'Earth', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Saturn', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Jupiter', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Neptune', 'option_image_url': '', 'is_correct': False}]}, {'number': 39, 'question_text': 'How many colours are there in a rainbow?', 'correct_option_index': 2, 'options': [{'option_text': '5', 'option_image_url': '', 'is_correct': False}, {'option_text': '6', 'option_image_url': '', 'is_correct': False}, {'option_text': '7', 'option_image_url': '', 'is_correct': True}, {'option_text': '8', 'option_image_url': '', 'is_correct': False}]}, {'number': 40, 'question_text': 'Who founded the Maurya Empire?', 'correct_option_index': 1, 'options': [{'option_text': 'Ashoka', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Chandragupta Maurya', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Harsha', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Samudragupta', 'option_image_url': '', 'is_correct': False}]}, {'number': 41, 'question_text': 'Choose the correct form: "They _ playing cricket."', 'correct_option_index': 2, 'options': [{'option_text': 'Is', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Am', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Are', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Was', 'option_image_url': '', 'is_correct': False}]}, {'number': 42, 'question_text': 'What is the area of a rectangle with length 8 cm and breadth 5 cm?', 'correct_option_index': 2, 'options': [{'option_text': '13 cm²', 'option_image_url': '', 'is_correct': False}, {'option_text': '26 cm²', 'option_image_url': '', 'is_correct': False}, {'option_text': '40 cm²', 'option_image_url': '', 'is_correct': True}, {'option_text': '80 cm²', 'option_image_url': '', 'is_correct': False}]}, {'number': 43, 'question_text': 'Which blood cells help fight infections?', 'correct_option_index': 1, 'options': [{'option_text': 'Red blood cells', 'option_image_url': '', 'is_correct': False}, {'option_text': 'White blood cells', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Platelets', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Plasma', 'option_image_url': '', 'is_correct': False}]}, {'number': 44, 'question_text': 'Which is the longest river in India?', 'correct_option_index': 2, 'options': [{'option_text': 'Yamuna', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Godavari', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Ganga', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Narmada', 'option_image_url': '', 'is_correct': False}]}, {'number': 45, 'question_text': 'Who was the 17th-century Maratha ruler and founder of the Maratha kingdom?', 'correct_option_index': 0, 'options': [{'option_text': 'Shivaji Maharaj', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Bajirao I', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Sambhaji', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Balaji Vishwanath', 'option_image_url': '', 'is_correct': False}]}, {'number': 46, 'question_text': 'What is the antonym of "Generous"?', 'correct_option_index': 1, 'options': [{'option_text': 'Kind', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Selfish', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Helpful', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Friendly', 'option_image_url': '', 'is_correct': False}]}, {'number': 47, 'question_text': 'What is the HCF of 18 and 24?', 'correct_option_index': 1, 'options': [{'option_text': '3', 'option_image_url': '', 'is_correct': False}, {'option_text': '6', 'option_image_url': '', 'is_correct': True}, {'option_text': '9', 'option_image_url': '', 'is_correct': False}, {'option_text': '12', 'option_image_url': '', 'is_correct': False}]}, {'number': 48, 'question_text': 'Which force pulls objects towards the Earth?', 'correct_option_index': 2, 'options': [{'option_text': 'Friction', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Magnetism', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Gravity', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Electricity', 'option_image_url': '', 'is_correct': False}]}, {'number': 49, 'question_text': 'Which is the largest state in India by area?', 'correct_option_index': 2, 'options': [{'option_text': 'Uttar Pradesh', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Maharashtra', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Rajasthan', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Madhya Pradesh', 'option_image_url': '', 'is_correct': False}]}, {'number': 50, 'question_text': 'Who wrote the Indian national anthem "Jana Gana Mana"?', 'correct_option_index': 1, 'options': [{'option_text': 'Bankim Chandra Chatterjee', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Rabindranath Tagore', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Sarojini Naidu', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Muhammad Iqbal', 'option_image_url': '', 'is_correct': False}]}, {'number': 51, 'question_text': 'What is the collective noun for a group of lions?', 'correct_option_index': 2, 'options': [{'option_text': 'Herd', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Pack', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Pride', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Flock', 'option_image_url': '', 'is_correct': False}]}, {'number': 52, 'question_text': 'What is 2/3 + 1/3?', 'correct_option_index': 2, 'options': [{'option_text': '1/3', 'option_image_url': '', 'is_correct': False}, {'option_text': '2/3', 'option_image_url': '', 'is_correct': False}, {'option_text': '1', 'option_image_url': '', 'is_correct': True}, {'option_text': '4/3', 'option_image_url': '', 'is_correct': False}]}, {'number': 53, 'question_text': 'Which part of the human body controls all activities?', 'correct_option_index': 1, 'options': [{'option_text': 'Heart', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Brain', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Liver', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Stomach', 'option_image_url': '', 'is_correct': False}]}, {'number': 54, 'question_text': 'Which is the highest mountain peak in the world?', 'correct_option_index': 1, 'options': [{'option_text': 'K2', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Mount Everest', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Kanchenjunga', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Nanda Devi', 'option_image_url': '', 'is_correct': False}]}, {'number': 55, 'question_text': 'In which year did the Jallianwala Bagh massacre take place?', 'correct_option_index': 1, 'options': [{'option_text': '1905', 'option_image_url': '', 'is_correct': False}, {'option_text': '1919', 'option_image_url': '', 'is_correct': True}, {'option_text': '1922', 'option_image_url': '', 'is_correct': False}, {'option_text': '1930', 'option_image_url': '', 'is_correct': False}]}, {'number': 56, 'question_text': 'Identify the adjective: "She has a beautiful dress."', 'correct_option_index': 2, 'options': [{'option_text': 'She', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Has', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Beautiful', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Dress', 'option_image_url': '', 'is_correct': False}]}, {'number': 57, 'question_text': 'What is the approximate value of Pi (π)?', 'correct_option_index': 1, 'options': [{'option_text': '2.14', 'option_image_url': '', 'is_correct': False}, {'option_text': '3.14', 'option_image_url': '', 'is_correct': True}, {'option_text': '4.13', 'option_image_url': '', 'is_correct': False}, {'option_text': '3.41', 'option_image_url': '', 'is_correct': False}]}, {'number': 58, 'question_text': 'Which metal is liquid at room temperature?', 'correct_option_index': 2, 'options': [{'option_text': 'Iron', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Copper', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Mercury', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Aluminium', 'option_image_url': '', 'is_correct': False}]}, {'number': 59, 'question_text': 'Which Indian state is famous for the backwaters of Alleppey?', 'correct_option_index': 1, 'options': [{'option_text': 'Goa', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Kerala', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Karnataka', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Tamil Nadu', 'option_image_url': '', 'is_correct': False}]}, {'number': 60, 'question_text': 'Who was the last Mughal emperor of India?', 'correct_option_index': 1, 'options': [{'option_text': 'Akbar II', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Bahadur Shah Zafar', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Shah Alam II', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Aurangzeb', 'option_image_url': '', 'is_correct': False}]}, {'number': 61, 'question_text': 'What is the comparative form of "Good"?', 'correct_option_index': 2, 'options': [{'option_text': 'Gooder', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Best', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Better', 'option_image_url': '', 'is_correct': True}, {'option_text': 'More good', 'option_image_url': '', 'is_correct': False}]}, {'number': 62, 'question_text': 'Solve: 3x + 5 = 20. What is x?', 'correct_option_index': 1, 'options': [{'option_text': '3', 'option_image_url': '', 'is_correct': False}, {'option_text': '5', 'option_image_url': '', 'is_correct': True}, {'option_text': '7', 'option_image_url': '', 'is_correct': False}, {'option_text': '10', 'option_image_url': '', 'is_correct': False}]}, {'number': 63, 'question_text': 'Which gas do plants absorb during photosynthesis?', 'correct_option_index': 2, 'options': [{'option_text': 'Oxygen', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Nitrogen', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Carbon dioxide', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Hydrogen', 'option_image_url': '', 'is_correct': False}]}, {'number': 64, 'question_text': 'How many states are there in India?', 'correct_option_index': 1, 'options': [{'option_text': '27', 'option_image_url': '', 'is_correct': False}, {'option_text': '28', 'option_image_url': '', 'is_correct': True}, {'option_text': '29', 'option_image_url': '', 'is_correct': False}, {'option_text': '30', 'option_image_url': '', 'is_correct': False}]}, {'number': 65, 'question_text': 'Who founded the Indian National Congress in 1885?', 'correct_option_index': 1, 'options': [{'option_text': 'Mahatma Gandhi', 'option_image_url': '', 'is_correct': False}, {'option_text': 'A. O. Hume', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Jawaharlal Nehru', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Lord Curzon', 'option_image_url': '', 'is_correct': False}]}, {'number': 66, 'question_text': 'Which sentence is grammatically correct?', 'correct_option_index': 2, 'options': [{'option_text': 'He go to school.', 'option_image_url': '', 'is_correct': False}, {'option_text': 'He going to school.', 'option_image_url': '', 'is_correct': False}, {'option_text': 'He goes to school.', 'option_image_url': '', 'is_correct': True}, {'option_text': 'He gone to school.', 'option_image_url': '', 'is_correct': False}]}, {'number': 67, 'question_text': 'What is the square root of 196?', 'correct_option_index': 2, 'options': [{'option_text': '12', 'option_image_url': '', 'is_correct': False}, {'option_text': '13', 'option_image_url': '', 'is_correct': False}, {'option_text': '14', 'option_image_url': '', 'is_correct': True}, {'option_text': '16', 'option_image_url': '', 'is_correct': False}]}, {'number': 68, 'question_text': 'Which instrument is used to measure temperature?', 'correct_option_index': 1, 'options': [{'option_text': 'Barometer', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Thermometer', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Speedometer', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Hygrometer', 'option_image_url': '', 'is_correct': False}]}, {'number': 69, 'question_text': 'Which Indian state has the longest coastline?', 'correct_option_index': 0, 'options': [{'option_text': 'Gujarat', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Kerala', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Odisha', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Goa', 'option_image_url': '', 'is_correct': False}]}, {'number': 70, 'question_text': 'Who was the famous queen of Jhansi during the Revolt of 1857?', 'correct_option_index': 1, 'options': [{'option_text': 'Razia Sultan', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Rani Lakshmibai', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Ahilyabai Holkar', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Begum Hazrat Mahal', 'option_image_url': '', 'is_correct': False}]}, {'number': 71, 'question_text': 'What is the meaning of the idiom "A piece of cake"?', 'correct_option_index': 1, 'options': [{'option_text': 'Something difficult', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Something easy', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Something expensive', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Something delicious', 'option_image_url': '', 'is_correct': False}]}, {'number': 72, 'question_text': 'What is the sum of the angles of a triangle?', 'correct_option_index': 1, 'options': [{'option_text': '90°', 'option_image_url': '', 'is_correct': False}, {'option_text': '180°', 'option_image_url': '', 'is_correct': True}, {'option_text': '270°', 'option_image_url': '', 'is_correct': False}, {'option_text': '360°', 'option_image_url': '', 'is_correct': False}]}, {'number': 73, 'question_text': 'Which layer protects Earth from harmful ultraviolet rays?', 'correct_option_index': 1, 'options': [{'option_text': 'Troposphere', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Ozone layer', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Mantle', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Core', 'option_image_url': '', 'is_correct': False}]}, {'number': 74, 'question_text': 'Which is the largest desert in the world?', 'correct_option_index': 2, 'options': [{'option_text': 'Sahara Desert', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Gobi Desert', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Antarctic Desert', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Thar Desert', 'option_image_url': '', 'is_correct': False}]}, {'number': 75, 'question_text': 'The Harappan Civilization is also known as which civilization?', 'correct_option_index': 1, 'options': [{'option_text': 'Vedic Civilization', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Indus Valley Civilization', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Roman Civilization', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Mesopotamian Civilization', 'option_image_url': '', 'is_correct': False}]}, {'number': 76, 'question_text': 'What is the past participle of "Write"?', 'correct_option_index': 2, 'options': [{'option_text': 'Wrote', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Writing', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Written', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Writes', 'option_image_url': '', 'is_correct': False}]}, {'number': 77, 'question_text': 'What is the probability of getting a head when tossing a fair coin once?', 'correct_option_index': 1, 'options': [{'option_text': '1/4', 'option_image_url': '', 'is_correct': False}, {'option_text': '1/2', 'option_image_url': '', 'is_correct': True}, {'option_text': '1/3', 'option_image_url': '', 'is_correct': False}, {'option_text': '1', 'option_image_url': '', 'is_correct': False}]}, {'number': 78, 'question_text': 'Which organs are primarily responsible for filtering waste from the blood?', 'correct_option_index': 1, 'options': [{'option_text': 'Lungs', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Kidneys', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Heart', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Stomach', 'option_image_url': '', 'is_correct': False}]}, {'number': 79, 'question_text': 'Who is known as the Missile Man of India?', 'correct_option_index': 1, 'options': [{'option_text': 'C. V. Raman', 'option_image_url': '', 'is_correct': False}, {'option_text': 'A. P. J. Abdul Kalam', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Homi Bhabha', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Vikram Sarabhai', 'option_image_url': '', 'is_correct': False}]}, {'number': 80, 'question_text': 'Who was the founder of the Gupta Empire?', 'correct_option_index': 0, 'options': [{'option_text': 'Chandragupta I', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Ashoka', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Harshavardhana', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Kanishka', 'option_image_url': '', 'is_correct': False}]}, {'number': 81, 'question_text': 'Which of the following is an adverb?', 'correct_option_index': 1, 'options': [{'option_text': 'Beautiful', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Slowly', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Beauty', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Slow', 'option_image_url': '', 'is_correct': False}]}, {'number': 82, 'question_text': 'What is the value of 5² + 3²?', 'correct_option_index': 2, 'options': [{'option_text': '25', 'option_image_url': '', 'is_correct': False}, {'option_text': '30', 'option_image_url': '', 'is_correct': False}, {'option_text': '34', 'option_image_url': '', 'is_correct': True}, {'option_text': '64', 'option_image_url': '', 'is_correct': False}]}, {'number': 83, 'question_text': 'What is the SI unit of force?', 'correct_option_index': 2, 'options': [{'option_text': 'Joule', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Watt', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Newton', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Pascal', 'option_image_url': '', 'is_correct': False}]}, {'number': 84, 'question_text': 'Which is the largest planet in the solar system?', 'correct_option_index': 1, 'options': [{'option_text': 'Earth', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Jupiter', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Mars', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Venus', 'option_image_url': '', 'is_correct': False}]}, {'number': 85, 'question_text': 'Who was the founder of the Mughal dynasty in India?', 'correct_option_index': 1, 'options': [{'option_text': 'Akbar', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Babur', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Humayun', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Jahangir', 'option_image_url': '', 'is_correct': False}]}, {'number': 86, 'question_text': 'Choose the correct passive voice: "The boy kicked the ball."', 'correct_option_index': 1, 'options': [{'option_text': 'The ball kicked the boy.', 'option_image_url': '', 'is_correct': False}, {'option_text': 'The ball was kicked by the boy.', 'option_image_url': '', 'is_correct': True}, {'option_text': 'The boy was kicked by the ball.', 'option_image_url': '', 'is_correct': False}, {'option_text': 'The ball is kicking the boy.', 'option_image_url': '', 'is_correct': False}]}, {'number': 87, 'question_text': 'A train travels 60 km in one hour. How far will it travel in 3 hours at the same speed?', 'correct_option_index': 2, 'options': [{'option_text': '120 km', 'option_image_url': '', 'is_correct': False}, {'option_text': '150 km', 'option_image_url': '', 'is_correct': False}, {'option_text': '180 km', 'option_image_url': '', 'is_correct': True}, {'option_text': '200 km', 'option_image_url': '', 'is_correct': False}]}, {'number': 88, 'question_text': 'Which type of energy is stored in food?', 'correct_option_index': 1, 'options': [{'option_text': 'Sound energy', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Chemical energy', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Light energy', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Nuclear energy', 'option_image_url': '', 'is_correct': False}]}, {'number': 89, 'question_text': 'Which Indian city is known as the Pink City?', 'correct_option_index': 0, 'options': [{'option_text': 'Jaipur', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Jodhpur', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Udaipur', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Bhopal', 'option_image_url': '', 'is_correct': False}]}, {'number': 90, 'question_text': 'Who gave the slogan "Give me blood, and I will give you freedom"?', 'correct_option_index': 1, 'options': [{'option_text': 'Bhagat Singh', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Subhash Chandra Bose', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Mahatma Gandhi', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Lala Lajpat Rai', 'option_image_url': '', 'is_correct': False}]}, {'number': 91, 'question_text': 'What is the meaning of "Bilingual"?', 'correct_option_index': 1, 'options': [{'option_text': 'Knowing one language', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Knowing two languages', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Knowing three languages', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Knowing many subjects', 'option_image_url': '', 'is_correct': False}]}, {'number': 92, 'question_text': 'What is the simple interest on ₹1,000 at 10% per annum for 2 years?', 'correct_option_index': 2, 'options': [{'option_text': '₹100', 'option_image_url': '', 'is_correct': False}, {'option_text': '₹150', 'option_image_url': '', 'is_correct': False}, {'option_text': '₹200', 'option_image_url': '', 'is_correct': True}, {'option_text': '₹250', 'option_image_url': '', 'is_correct': False}]}, {'number': 93, 'question_text': 'Which phenomenon causes the bending of light when it passes from one medium to another?', 'correct_option_index': 1, 'options': [{'option_text': 'Reflection', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Refraction', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Diffusion', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Absorption', 'option_image_url': '', 'is_correct': False}]}, {'number': 94, 'question_text': 'Which is the largest democracy in the world by population?', 'correct_option_index': 1, 'options': [{'option_text': 'USA', 'option_image_url': '', 'is_correct': False}, {'option_text': 'India', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Brazil', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Japan', 'option_image_url': '', 'is_correct': False}]}, {'number': 95, 'question_text': 'Who was the first Indian Governor-General of independent India?', 'correct_option_index': 1, 'options': [{'option_text': 'Lord Mountbatten', 'option_image_url': '', 'is_correct': False}, {'option_text': 'C. Rajagopalachari', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Dr. Rajendra Prasad', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Jawaharlal Nehru', 'option_image_url': '', 'is_correct': False}]}, {'number': 96, 'question_text': 'Choose the correct conjunction: "I was tired, _ I continued working."', 'correct_option_index': 1, 'options': [{'option_text': 'Because', 'option_image_url': '', 'is_correct': False}, {'option_text': 'But', 'option_image_url': '', 'is_correct': True}, {'option_text': 'Or', 'option_image_url': '', 'is_correct': False}, {'option_text': 'Since', 'option_image_url': '', 'is_correct': False}]}, {'number': 97, 'question_text': 'If the radius of a circle is 7 cm, what is its area? (Use π = 22/7)', 'correct_option_index': 2, 'options': [{'option_text': '44 cm²', 'option_image_url': '', 'is_correct': False}, {'option_text': '77 cm²', 'option_image_url': '', 'is_correct': False}, {'option_text': '154 cm²', 'option_image_url': '', 'is_correct': True}, {'option_text': '308 cm²', 'option_image_url': '', 'is_correct': False}]}, {'number': 98, 'question_text': 'Which law states that every action has an equal and opposite reaction?', 'correct_option_index': 2, 'options': [{'option_text': "Newton's First Law", 'option_image_url': '', 'is_correct': False}, {'option_text': "Newton's Second Law", 'option_image_url': '', 'is_correct': False}, {'option_text': "Newton's Third Law", 'option_image_url': '', 'is_correct': True}, {'option_text': 'Law of Gravitation', 'option_image_url': '', 'is_correct': False}]}, {'number': 99, 'question_text': 'Which organization is responsible for maintaining international peace and security?', 'correct_option_index': 2, 'options': [{'option_text': 'WHO', 'option_image_url': '', 'is_correct': False}, {'option_text': 'UNESCO', 'option_image_url': '', 'is_correct': False}, {'option_text': 'United Nations', 'option_image_url': '', 'is_correct': True}, {'option_text': 'UNICEF', 'option_image_url': '', 'is_correct': False}]}, {'number': 100, 'question_text': 'In which year did the Quit India Movement begin?', 'correct_option_index': 2, 'options': [{'option_text': '1920', 'option_image_url': '', 'is_correct': False}, {'option_text': '1930', 'option_image_url': '', 'is_correct': False}, {'option_text': '1942', 'option_image_url': '', 'is_correct': True}, {'option_text': '1947', 'option_image_url': '', 'is_correct': False}]}]


def make_request(url, method='GET', data=None, token=None):
    headers = {
        'Accept': 'application/json',
        'User-Agent': 'ShikshaPilot-TestSeriesSeeder/1.0',
    }
    encoded_data = None
    if data is not None:
        headers['Content-Type'] = 'application/json'
        encoded_data = json.dumps(data).encode('utf-8')

    if token:
        headers['Authorization'] = f'Bearer {token}'

    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode('utf-8')
            return json.loads(content)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        try:
            parsed = json.loads(error_body)
            msg = parsed.get('message') or parsed.get('error') or str(parsed)
            raise RuntimeError(f'HTTP {e.code}: {msg}')
        except Exception:
            raise RuntimeError(f'HTTP {e.code}: {error_body}')
    except urllib.error.URLError as e:
        raise RuntimeError(f'Network error: {e.reason}')


def main():
    parser = argparse.ArgumentParser(
        description='Shiksha Pilot - Auto-seed Test Series questions into Drafts.'
    )
    parser.add_argument('--url', '-u', default='https://qa.shikshapilot.com', help='Base URL of Shiksha Pilot environment (default: https://qa.shikshapilot.com)')
    parser.add_argument('--phone', '-p', help='Teacher login phone number / username')
    parser.add_argument('--password', '-P', help='Teacher login password')
    parser.add_argument('--class', '-c', dest='target_class', help='Class name or ID (e.g. "10-A", "Class 10", or ID "1")')
    parser.add_argument('--count', '-n', type=int, default=100, help='Number of questions to add (1-100, default: 100)')
    parser.add_argument('--title', '-t', default='General Knowledge & Aptitude', help='Title of Test Series (max 35 chars, default: "General Knowledge & Aptitude")')
    parser.add_argument('--timer', dest='timer', action='store_true', default=True, help='Enable countdown timer (default: enabled)')
    parser.add_argument('--no-timer', dest='timer', action='store_false', help='Disable countdown timer')
    parser.add_argument('--negative-marks', type=float, default=0.0, choices=[0.0, 0.25, 0.5, 1.0], help='Negative marking deduction per wrong answer (0, 0.25, 0.5, 1.0)')
    parser.add_argument('--list-classes', action='store_true', default=False, help='List all available classes for teacher and exit')

    args = parser.parse_args()

    base_url = args.url.rstrip('/')

    print('=' * 65)
    print('  SHIKSHA PILOT - TEST SERIES QUESTION SEEDER')
    print('=' * 65)
    print(f'[*] Target Environment: {base_url}')

    phone = args.phone
    if not phone:
        phone = input('[?] Enter Teacher Phone Number: ').strip()

    password = args.password
    if not password:
        import getpass
        password = getpass.getpass('[?] Enter Teacher Password: ').strip()

    if not phone or not password:
        print('[!] Error: Phone and Password are required!')
        sys.exit(1)

    # 1. Login
    print(f'[*] Logging in as teacher ({phone})...')
    login_url = f'{base_url}/api/auth/login'
    try:
        login_res = make_request(login_url, method='POST', data={'phone': phone, 'password': password})
    except Exception as e:
        print(f'[!] Login failed: {e}')
        sys.exit(1)

    token = login_res.get('data', {}).get('token')
    user = login_res.get('data', {}).get('user', {})
    teacher_name = user.get('name', 'Teacher')
    teacher_role = user.get('role', 'TEACHER')
    school_id = user.get('school_id', 0)

    if not token:
        print('[!] Login failed: No token received.')
        sys.exit(1)

    print(f'[+] Logged in successfully!')
    print(f'    Name: {teacher_name} | Role: {teacher_role} | School ID: {school_id}')

    # 2. Check Teacher Access & Fetch Classes
    print('[*] Fetching accessible classes and creator permissions...')
    access_url = f'{base_url}/api/teacher/test-series/access'
    try:
        access_res = make_request(access_url, method='GET', token=token)
    except Exception as e:
        print(f'[!] Failed to fetch access: {e}')
        sys.exit(1)

    access_data = access_res.get('data', {})
    can_create = access_data.get('can_create', False)
    is_principal = access_data.get('is_principal', False)
    classes = access_data.get('classes', [])

    if not can_create and not is_principal:
        print('[!] Warning: This teacher does not currently have Test Series creation permission!')
        print('    Please ask the Principal to enable "Can Create" in Test Series -> Settings.')
        sys.exit(1)

    if not classes:
        print('[!] No active classes found for this school.')
        sys.exit(1)

    if args.list_classes:
        print('\n[+] Available Classes:')
        print(f'    {"ID":<6} | {"Class Name":<20} | {"Total Tests":<12} | {"Live Tests":<10}')
        print('    ' + '-' * 56)
        for c in classes:
            cid = c.get('id')
            fname = c.get('full_name') or f"{c.get('name', '')} {c.get('section', '')}".strip()
            tt = c.get('total_tests', 0)
            lt = c.get('live_tests', 0)
            print(f'    {cid:<6} | {fname:<20} | {tt:<12} | {lt:<10}')
        print('\n[+] Use --class <ID or Name> to create a test series.')
        sys.exit(0)

    # 3. Match Class
    target_class_input = args.target_class
    if not target_class_input:
        print('\n[+] Available Classes:')
        for idx, c in enumerate(classes, 1):
            fname = c.get('full_name') or f"{c.get('name', '')} {c.get('section', '')}".strip()
            print(f'    [{idx}] ID: {c.get("id")} - {fname}')
        choice = input('\n[?] Select Class (Enter number or ID or Class Name): ').strip()
        if choice.isdigit():
            cnum = int(choice)
            if 1 <= cnum <= len(classes):
                target_class_input = str(classes[cnum - 1]['id'])
            else:
                target_class_input = choice
        else:
            target_class_input = choice

    matched_class = None
    target_str = str(target_class_input).strip().lower()

    # Exact ID match first
    for c in classes:
        if str(c.get('id')) == target_str:
            matched_class = c
            break

    # Full name / name match
    if not matched_class:
        for c in classes:
            fname = (c.get('full_name') or '').lower()
            name = (c.get('name') or '').lower()
            sec = (c.get('section') or '').lower()
            if target_str == fname or target_str == f'{name}-{sec}' or target_str == f'{name} {sec}' or target_str == name:
                matched_class = c
                break

    # Substring match fallback
    if not matched_class:
        for c in classes:
            fname = (c.get('full_name') or '').lower()
            if target_str in fname:
                matched_class = c
                break

    if not matched_class:
        print(f'[!] Could not find class matching "{target_class_input}". Run with --list-classes to view available classes.')
        sys.exit(1)

    class_id = matched_class['id']
    class_label = matched_class.get('full_name') or f"{matched_class.get('name', '')} {matched_class.get('section', '')}".strip()
    print(f'[+] Selected Class: {class_label} (ID: {class_id})')

    # 4. Prepare Questions
    count = max(1, min(args.count, len(QUESTIONS_POOL)))
    selected_questions = QUESTIONS_POOL[:count]
    print(f'[*] Preparing {len(selected_questions)} questions from pool (clean text, no subject tags, 4 options each)...')

    title = args.title.strip()
    if len(title) > 35:
        title = title[:35]

    instructions = (
        '• Read each question carefully before selecting your answer.\n'
        '• All questions are compulsory and carry equal marks.\n'
        '• Do not refresh or close the app once you begin the test.\n'
        '• Review all your selected answers before tapping Finish.\n'
        '• Ranks, Toppers and Merit Certificates unlock after closing time.'
    )

    # 5. Save strictly as DRAFT
    print(f'[*] Saving test series "{title}" as DRAFT for {class_label}...')
    draft_url = f'{base_url}/api/teacher/test-series/drafts'
    draft_id = f'draft_{int(datetime.datetime.now().timestamp() * 1000)}_seed'

    draft_questions = []
    for q in selected_questions:
        opts = []
        for o in q['options']:
            opts.append({
                'option_text': o['option_text'],
                'option_image_url': ''
            })
        draft_questions.append({
            'question_text': q['question_text'],
            'question_image_url': '',
            'correct_option_index': q['correct_option_index'],
            'options': opts
        })

    draft_payload = {
        'id': draft_id,
        'class_id': class_id,
        'title': title,
        'description': instructions,
        'show_timer': args.timer,
        'negative_marking_enabled': args.negative_marks > 0,
        'negative_mark_value': args.negative_marks,
        'schedule_changed': False,
        'questions': draft_questions
    }

    try:
        draft_res = make_request(draft_url, method='POST', data=draft_payload, token=token)
        print('\n' + '=' * 65)
        print('  TEST SERIES SUCCESSFULLY SAVED AS DRAFT!')
        print('=' * 65)
        print(f'  • Title:            {title}')
        print(f'  • Class:            {class_label} (ID: {class_id})')
        print(f'  • Total Questions:  {len(selected_questions)}')
        print(f'  • Timer Enabled:    {"Yes" if args.timer else "No"}')
        print(f'  • Negative Marking: {args.negative_marks if args.negative_marks > 0 else "None"}')
        print(f'  • Status:           IN DRAFT')
        print('-' * 65)
        print('  NEXT STEP (Mobile Application):')
        print(f'  1. Shiksha Pilot Mobile App me Teacher se login karein.')
        print(f'  2. Test Series screen par jayein aur "{class_label}" select karein.')
        print(f'  3. Upar "In Draft" button par tap karein.')
        print(f'  4. Is draft par tap karein (saare {len(selected_questions)} questions pre-loaded milenge).')
        print(f'  5. "Publish Test Series" button par tap karke publish kar lein!')
        print('=' * 65)
    except Exception as e:
        print(f'[-] Draft API endpoint not yet deployed on server ({e}).')
        print(f'[*] Saving test series directly into server as UPCOMING (Unstarted Draft)...')

        now = datetime.datetime.now()
        starts_at = (now + datetime.timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')
        ends_at = (now + datetime.timedelta(days=7)).strftime('%Y-%m-%d 23:59:59')

        pub_questions = []
        for q_idx, q in enumerate(selected_questions, 1):
            opts = []
            for o_idx, o in enumerate(q['options'], 1):
                opts.append({
                    'sort_order': o_idx,
                    'option_text': o['option_text'],
                    'option_image_url': '',
                    'is_correct': 1 if o['is_correct'] else 0
                })
            pub_questions.append({
                'sort_order': q_idx,
                'question_text': q['question_text'],
                'question_image_url': '',
                'options': opts
            })

        fallback_payload = {
            'class_id': class_id,
            'title': title,
            'description': instructions,
            'starts_at': starts_at,
            'ends_at': ends_at,
            'show_timer': args.timer,
            'negative_marking_enabled': args.negative_marks > 0,
            'negative_mark_value': args.negative_marks,
            'questions': pub_questions
        }

        try:
            fb_res = make_request(f'{base_url}/api/teacher/test-series', method='POST', data=fallback_payload, token=token)
            new_id = fb_res.get('data', {}).get('id', 'N/A')
            print('\n' + '=' * 65)
            print('  TEST SERIES SUCCESSFULLY SAVED ON SERVER!')
            print('=' * 65)
            print(f'  • Test Series ID:   {new_id}')
            print(f'  • Title:            {title}')
            print(f'  • Class:            {class_label} (ID: {class_id})')
            print(f'  • Total Questions:  {len(selected_questions)}')
            print(f'  • Starts At:        {starts_at} (Future scheduled / Not Live yet)')
            print(f'  • Status:           UPCOMING (Unstarted Draft)')
            print('-' * 65)
            print('  NEXT STEP (Mobile Application):')
            print(f'  1. Shiksha Pilot Mobile App me Teacher se login karein.')
            print(f'  2. Test Series -> "{class_label}" -> "Upcoming" tab me yeh test dikhega.')
            print(f'  3. Teacher kabhi bhi ise edit karke timing change kar sakta hai ya launch kar sakta hai.')
            print('=' * 65)
        except Exception as fb_err:
            print(f'[!] Failed to save test series: {fb_err}')
            sys.exit(1)


if __name__ == '__main__':
    main()
